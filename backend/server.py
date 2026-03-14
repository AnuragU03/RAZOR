from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from models.schemas import (
    ProjectCreate, Project, ProjectResponse,
    PipelineRunCreate, PipelineRun, PipelineRunResponse,
)
from services.github_service import parse_repo_url, fetch_repo_info, fetch_ci_workflow_runs, fetch_ci_run_logs
from services.docs_pipeline import run_docs_pipeline
from services.bugfix_pipeline import run_bugfix_pipeline
from services.s2_service import get_audit_summary, read_stream

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="EngineOps API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# In-memory SSE event queues per pipeline run
_sse_queues: dict[str, list[asyncio.Queue]] = {}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# --- SSE Event System ---
async def pipeline_event_callback(run_id: str, step_idx: int, step_name: str, status: str, output: str = None, error: str = None):
    """Push events to all SSE listeners for a pipeline run."""
    event = {
        "run_id": run_id,
        "step_index": step_idx,
        "step_name": step_name,
        "status": status,
        "output": output[:500] if output else None,
        "error": error,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if run_id in _sse_queues:
        for queue in _sse_queues[run_id]:
            await queue.put(event)


# --- Health Check ---
@api_router.get("/")
async def root():
    return {"message": "EngineOps API v1.0", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# --- One-Click Demo ---
DEMO_REPO = "https://github.com/pallets/flask"
DEMO_CI_LOG = """=== GitHub Actions CI — Build & Test ===
Run: ubuntu-latest / Python 3.11
Job: test (3.11)

> pip install -e ".[dev]"
> python -m pytest tests/ -x --tb=short

FAILED tests/test_basic.py::test_make_response_with_response_instance
tests/test_basic.py:142: in test_make_response_with_response_instance
    rv = client.get("/")
tests/test_basic.py:138: in index
    response = flask.make_response(flask.Response("Hello", status=200))
E   TypeError: make_response() got an unexpected keyword argument 'status'

During handling of the above exception, another exception occurred:
tests/test_basic.py:142: in test_make_response_with_response_instance
    rv = client.get("/")
src/flask/app.py:1498: in __call__
    return self.wsgi_app(environ, start_response)
src/flask/app.py:1476: in wsgi_app
    response = self.handle_exception(e)
src/flask/app.py:862: in handle_exception
    raise e
src/flask/app.py:1473: in wsgi_app
    response = self.full_dispatch_request()
src/flask/app.py:920: in full_dispatch_request
    rv = self.dispatch_request()
src/flask/app.py:901: in dispatch_request
    return self.ensure_sync(self.view_functions[rule.endpoint])(**req.view_args)

FAILED (1 failed, 247 passed, 12 skipped in 14.23s)
Error: Process completed with exit code 1."""


@api_router.post("/demo")
async def create_demo_project(background_tasks: BackgroundTasks):
    """One-click demo: create a project with a known repo and trigger both pipelines."""
    try:
        owner, repo_name = parse_repo_url(DEMO_REPO)
    except Exception:
        raise HTTPException(status_code=400, detail="Demo repo URL error")

    # Check if demo project already exists
    existing = await db.projects.find_one({"repo_url": DEMO_REPO}, {"_id": 0})
    if existing:
        # Re-trigger pipelines on existing project
        project_id = existing["id"]
        # Cancel any running pipelines first
        await db.pipeline_runs.update_many(
            {"project_id": project_id, "status": "running"},
            {"$set": {"status": "failed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new demo project
        try:
            await fetch_repo_info(owner, repo_name)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not access demo repo: {str(e)}")

        project = Project(
            repo_url=DEMO_REPO,
            repo_owner=owner,
            repo_name=repo_name,
        )
        doc = project.model_dump()
        await db.projects.insert_one(doc)
        project_id = project.id

    # Trigger both pipelines
    background_tasks.add_task(run_docs_pipeline, project_id, db, pipeline_event_callback)
    background_tasks.add_task(run_bugfix_pipeline, project_id, DEMO_CI_LOG, db, pipeline_event_callback)

    return {
        "status": "demo_started",
        "project_id": project_id,
        "message": "Demo started! Both docs and bugfix pipelines are running.",
        "repo": DEMO_REPO,
    }


# --- Project CRUD ---
@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(input_data: ProjectCreate):
    """Create a new project from a GitHub repo URL."""
    try:
        owner, repo_name = parse_repo_url(input_data.repo_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    # Verify repo exists
    try:
        await fetch_repo_info(owner, repo_name, input_data.github_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not access repository: {str(e)}")

    project = Project(
        repo_url=input_data.repo_url,
        repo_owner=owner,
        repo_name=repo_name,
        github_token=input_data.github_token,
    )

    doc = project.model_dump()
    await db.projects.insert_one(doc)

    return ProjectResponse(
        id=project.id,
        repo_url=project.repo_url,
        repo_owner=owner,
        repo_name=repo_name,
        status=project.status,
        created_at=project.created_at,
    )


@api_router.get("/projects", response_model=List[ProjectResponse])
async def list_projects():
    """List all projects."""
    projects = await db.projects.find({}, {"_id": 0, "github_token": 0}).to_list(100)
    return projects


@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get a specific project."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0, "github_token": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and its associated data."""
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clean up associated data
    await db.pipeline_runs.delete_many({"project_id": project_id})
    await db.docs_results.delete_many({"project_id": project_id})
    await db.bugfix_results.delete_many({"project_id": project_id})

    return {"status": "deleted", "project_id": project_id}


# --- Documentation Pipeline ---
@api_router.post("/projects/{project_id}/run-docs")
async def trigger_docs_pipeline(project_id: str, background_tasks: BackgroundTasks):
    """Trigger the documentation generation pipeline."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if there's already a running pipeline
    running = await db.pipeline_runs.find_one(
        {"project_id": project_id, "pipeline_type": "docs", "status": "running"},
        {"_id": 0}
    )
    if running:
        raise HTTPException(status_code=409, detail="A documentation pipeline is already running")

    # Run in background
    background_tasks.add_task(run_docs_pipeline, project_id, db, pipeline_event_callback)

    return {"status": "started", "message": "Documentation pipeline triggered"}


# --- Bug Fix Pipeline ---
@api_router.post("/projects/{project_id}/run-bugfix")
async def trigger_bugfix_pipeline(project_id: str, input_data: PipelineRunCreate, background_tasks: BackgroundTasks):
    """Trigger the bug fix pipeline with a CI log."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not input_data.ci_log:
        raise HTTPException(status_code=400, detail="CI log is required for bug fix pipeline")

    running = await db.pipeline_runs.find_one(
        {"project_id": project_id, "pipeline_type": "bugfix", "status": "running"},
        {"_id": 0}
    )
    if running:
        raise HTTPException(status_code=409, detail="A bug fix pipeline is already running")

    background_tasks.add_task(run_bugfix_pipeline, project_id, input_data.ci_log, db, pipeline_event_callback)

    return {"status": "started", "message": "Bug fix pipeline triggered"}


# --- Fetch CI Runs from GitHub ---
@api_router.get("/projects/{project_id}/ci-runs")
async def get_ci_runs(project_id: str):
    """Fetch recent CI workflow runs from GitHub."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    runs = await fetch_ci_workflow_runs(
        project["repo_owner"], project["repo_name"], project.get("github_token")
    )
    return {"runs": runs}


@api_router.get("/projects/{project_id}/ci-runs/{run_id}/logs")
async def get_ci_run_logs(project_id: str, run_id: int):
    """Fetch logs for a specific CI run."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    logs = await fetch_ci_run_logs(
        project["repo_owner"], project["repo_name"], run_id, project.get("github_token")
    )
    return {"logs": logs}


# --- Pipeline Runs ---
@api_router.get("/projects/{project_id}/pipeline-runs", response_model=List[PipelineRunResponse])
async def list_pipeline_runs(project_id: str, pipeline_type: Optional[str] = None):
    """List pipeline runs for a project."""
    query = {"project_id": project_id}
    if pipeline_type:
        query["pipeline_type"] = pipeline_type
    runs = await db.pipeline_runs.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return runs


@api_router.get("/pipeline-runs/{run_id}", response_model=PipelineRunResponse)
async def get_pipeline_run(run_id: str):
    """Get a specific pipeline run with step details."""
    run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return run


# --- SSE Stream ---
@api_router.get("/pipeline-runs/{run_id}/stream")
async def stream_pipeline_events(run_id: str):
    """Server-Sent Events stream for real-time pipeline updates."""
    queue = asyncio.Queue()
    if run_id not in _sse_queues:
        _sse_queues[run_id] = []
    _sse_queues[run_id].append(queue)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                    # If the pipeline completed or failed, send final event and close
                    if event.get("status") in ("completed", "failed"):
                        # Check if this is the last step
                        run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0})
                        if run and run.get("status") in ("completed", "failed"):
                            yield f"data: {json.dumps({'type': 'pipeline_complete', 'status': run['status']})}\n\n"
                            break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            if run_id in _sse_queues:
                _sse_queues[run_id].remove(queue)
                if not _sse_queues[run_id]:
                    del _sse_queues[run_id]

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# --- Results ---
@api_router.get("/projects/{project_id}/docs")
async def get_docs_result(project_id: str):
    """Get generated documentation for a project."""
    result = await db.docs_results.find_one(
        {"project_id": project_id},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not result:
        raise HTTPException(status_code=404, detail="No documentation found. Run the docs pipeline first.")
    return result


@api_router.get("/projects/{project_id}/bugfixes")
async def get_bugfix_results(project_id: str):
    """Get bug fix results for a project."""
    results = await db.bugfix_results.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"results": results}


@api_router.get("/projects/{project_id}/bugfixes/latest")
async def get_latest_bugfix(project_id: str):
    """Get the most recent bug fix result."""
    result = await db.bugfix_results.find_one(
        {"project_id": project_id},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not result:
        raise HTTPException(status_code=404, detail="No bug fixes found. Run the bugfix pipeline first.")
    return result


# --- Dashboard Stats ---
@api_router.get("/stats")
async def get_stats():
    """Get overall stats for the dashboard."""
    total_projects = await db.projects.count_documents({})
    total_runs = await db.pipeline_runs.count_documents({})
    completed_runs = await db.pipeline_runs.count_documents({"status": "completed"})
    docs_runs = await db.pipeline_runs.count_documents({"pipeline_type": "docs"})
    bugfix_runs = await db.pipeline_runs.count_documents({"pipeline_type": "bugfix"})

    return {
        "total_projects": total_projects,
        "total_pipeline_runs": total_runs,
        "completed_runs": completed_runs,
        "docs_pipeline_runs": docs_runs,
        "bugfix_pipeline_runs": bugfix_runs,
        "success_rate": round(completed_runs / total_runs * 100, 1) if total_runs > 0 else 0,
    }


# --- S2.dev Audit Trail / Replay ---
@api_router.get("/pipeline-runs/{run_id}/audit-trail")
async def get_pipeline_audit_trail(run_id: str):
    """Get the S2.dev audit trail for a pipeline run (for Replay Run button)."""
    summary = await get_audit_summary(run_id)
    return summary


@api_router.get("/pipeline-runs/{run_id}/replay")
async def replay_pipeline_run(run_id: str):
    """Read all S2 stream records for replay."""
    records = await read_stream(run_id)
    run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0})
    return {
        "run_id": run_id,
        "pipeline_type": run.get("pipeline_type") if run else None,
        "status": run.get("status") if run else None,
        "records": records,
        "total_records": len(records),
    }


# --- Partner Integration Status ---
@api_router.get("/partner-status")
async def get_partner_status():
    """Check which partner integrations are configured and active."""
    import services.s2_service as s2
    return {
        "unsiloed": {"configured": bool(os.environ.get("UNSILOED_API_KEY", "")) and not os.environ.get("UNSILOED_API_KEY", "").startswith("placeholder"), "name": "Unsiloed", "role": "Document Parser"},
        "safedep": {"configured": bool(os.environ.get("SAFEDEP_CLOUD_API_KEY", "")), "name": "Safedep", "role": "Security Scanner"},
        "s2": {"configured": s2._is_configured(), "name": "S2.dev", "role": "Audit Trail"},
        "gearsec": {"configured": not os.environ.get("GEARSEC_API_KEY", "").startswith("placeholder"), "name": "Gearsec", "role": "Policy Gate"},
        "concierge": {"configured": not os.environ.get("CONCIERGE_API_KEY", "").startswith("placeholder"), "name": "Concierge", "role": "Notifications"},
    }


# --- MCP Endpoint for Concierge ---
@api_router.post("/mcp")
async def mcp_endpoint():
    """MCP server endpoint for Concierge to call EngineOps as a tool."""
    return {
        "name": "engineops",
        "version": "1.0.0",
        "description": "AI-Native Engineering Operations — ships docs and bug-fix PRs from GitHub repos",
        "tools": [
            {"name": "run_docs_pipeline", "description": "Generate documentation for a GitHub repository"},
            {"name": "run_bugfix_pipeline", "description": "Analyze CI failure and generate bug-fix PR"},
            {"name": "get_project_status", "description": "Get status of a project and its pipeline runs"},
        ],
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
