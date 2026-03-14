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
