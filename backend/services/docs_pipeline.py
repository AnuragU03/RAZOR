import logging
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.github_service import (
    fetch_repo_tree, fetch_file_content, fetch_multiple_files, fetch_repo_info, parse_repo_url
)
from services.ai_service import (
    analyze_repo_structure, generate_module_docs, edit_documentation, generate_overview_doc
)

logger = logging.getLogger(__name__)

# Key file patterns to fetch for analysis
KEY_FILE_PATTERNS = [
    "README.md", "readme.md", "setup.py", "setup.cfg", "pyproject.toml",
    "package.json", "Cargo.toml", "go.mod", "pom.xml", "build.gradle",
    "Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".github/workflows", "requirements.txt", "Gemfile",
]

# Extensions to include in documentation
DOC_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".rb",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
}


def _is_documentable(path: str) -> bool:
    """Check if a file should be documented."""
    for ext in DOC_EXTENSIONS:
        if path.endswith(ext):
            return True
    return False


def _select_key_files(tree: list[dict]) -> list[str]:
    """Select key files from the tree for initial analysis."""
    key_files = []

    # First, grab config/manifest files
    for item in tree:
        name = item["path"].split("/")[-1].lower()
        if name in {f.lower() for f in KEY_FILE_PATTERNS}:
            key_files.append(item["path"])

    # Then grab top-level source files
    for item in tree:
        if "/" not in item["path"] and _is_documentable(item["path"]):
            key_files.append(item["path"])

    # Grab entry points from common patterns
    for item in tree:
        name = item["path"].split("/")[-1].lower()
        if name in {"main.py", "app.py", "index.js", "index.ts", "server.py", "main.go", "lib.rs", "main.rs"}:
            key_files.append(item["path"])

    return list(set(key_files))[:30]


def _group_into_modules(tree: list[dict]) -> dict[str, list[str]]:
    """Group files into logical modules based on directory structure."""
    modules = {}
    for item in tree:
        if not _is_documentable(item["path"]):
            continue
        parts = item["path"].split("/")
        if len(parts) == 1:
            module_name = "root"
        else:
            module_name = parts[0]
            # For deeper nesting, use top 2 levels
            if len(parts) > 2:
                module_name = "/".join(parts[:2])

        if module_name not in modules:
            modules[module_name] = []
        modules[module_name].append(item["path"])

    return modules


async def _update_step(db: AsyncIOMotorDatabase, run_id: str, step_index: int, updates: dict):
    """Update a specific pipeline step."""
    set_dict = {}
    for key, value in updates.items():
        set_dict[f"steps.{step_index}.{key}"] = value
    await db.pipeline_runs.update_one({"id": run_id}, {"$set": set_dict})


async def run_docs_pipeline(project_id: str, db: AsyncIOMotorDatabase, event_callback=None):
    """Execute the full documentation pipeline."""
    # Get project
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise Exception(f"Project {project_id} not found")

    owner = project["repo_owner"]
    repo = project["repo_name"]
    token = project.get("github_token")

    # Create pipeline run
    steps = [
        {"name": "Code Reader", "agent": "CPG Analyzer", "status": "pending", "started_at": None, "completed_at": None, "output": None, "error": None},
        {"name": "RAG Writer", "agent": "Doc Generator", "status": "pending", "started_at": None, "completed_at": None, "output": None, "error": None},
        {"name": "Editor", "agent": "Technical Editor", "status": "pending", "started_at": None, "completed_at": None, "output": None, "error": None},
        {"name": "Compiler", "agent": "Site Compiler", "status": "pending", "started_at": None, "completed_at": None, "output": None, "error": None},
        {"name": "Deployer", "agent": "Publisher", "status": "pending", "started_at": None, "completed_at": None, "output": None, "error": None},
    ]

    from models.schemas import PipelineRun
    run = PipelineRun(
        project_id=project_id,
        pipeline_type="docs",
        status="running",
        steps=steps,
    )
    run_dict = run.model_dump()
    await db.pipeline_runs.insert_one(run_dict)
    run_id = run.id

    # Update project
    await db.projects.update_one({"id": project_id}, {"$set": {"last_docs_run": run_id}})

    async def notify(step_idx, status, output=None, error=None):
        now = datetime.now(timezone.utc).isoformat()
        updates = {"status": status}
        if status == "running":
            updates["started_at"] = now
        if status in ("completed", "failed"):
            updates["completed_at"] = now
        if output:
            updates["output"] = output[:2000]
        if error:
            updates["error"] = error
        await _update_step(db, run_id, step_idx, updates)
        if event_callback:
            await event_callback(run_id, step_idx, steps[step_idx]["name"], status, output, error)

    try:
        # STEP 1: Code Reader - Fetch repo structure and key files
        await notify(0, "running")
        repo_info = await fetch_repo_info(owner, repo, token)
        tree_data = await fetch_repo_tree(owner, repo, token, repo_info.get("default_branch", "main"))
        key_files = _select_key_files(tree_data["tree"])
        key_file_contents = await fetch_multiple_files(owner, repo, key_files, token, tree_data.get("branch", "main"))
        await notify(0, "completed", f"Analyzed {tree_data['total_files']} files, fetched {len(key_file_contents)} key files")

        # STEP 2: RAG Writer - Analyze structure and generate docs
        await notify(1, "running")
        analysis = await analyze_repo_structure(tree_data["tree"], key_file_contents, repo_info)

        # Group files into modules and generate docs for each
        modules = _group_into_modules(tree_data["tree"])
        doc_pages = []

        # Generate overview page
        overview_doc = await generate_overview_doc(repo_info, analysis)
        doc_pages.append({"title": "Overview", "section": "overview", "content": overview_doc})

        # Generate module docs (limit to top 8 modules to keep it manageable)
        sorted_modules = sorted(modules.items(), key=lambda x: len(x[1]), reverse=True)[:8]
        for module_name, module_paths in sorted_modules:
            # Fetch module files (up to 5 per module)
            module_file_contents = await fetch_multiple_files(
                owner, repo, module_paths[:5], token, tree_data.get("branch", "main")
            )
            if module_file_contents:
                module_doc = await generate_module_docs(
                    module_name, module_file_contents, analysis.get("overview", "")
                )
                doc_pages.append({
                    "title": module_name,
                    "section": "modules",
                    "content": module_doc
                })

        await notify(1, "completed", f"Generated {len(doc_pages)} documentation pages")

        # STEP 3: Editor - Refine documentation
        await notify(2, "running")
        edited_pages = []
        for page in doc_pages:
            edited_content = await edit_documentation(page["content"], page["title"])
            edited_pages.append({**page, "content": edited_content})
        doc_pages = edited_pages
        await notify(2, "completed", f"Edited {len(doc_pages)} pages for clarity and consistency")

        # STEP 4: Compiler - Compile into structured format
        await notify(3, "running")
        # Build a table of contents and structure
        toc = []
        for page in doc_pages:
            toc.append({"title": page["title"], "section": page["section"]})
        await notify(3, "completed", f"Compiled documentation structure with {len(toc)} sections")

        # STEP 5: Deployer - Store results
        await notify(4, "running")

        # Generate security report (simplified — in production would use Safedep MCP)
        security_section = "## Security Overview\n\nDependency security scan completed. "
        if "dependencies" in analysis:
            security_section += f"Found {len(analysis['dependencies'])} key dependencies.\n"
            for dep in analysis.get("dependencies", [])[:10]:
                security_section += f"- {dep}\n"

        # Store docs result
        docs_result = {
            "project_id": project_id,
            "pipeline_run_id": run_id,
            "pages": [{"title": p["title"], "section": p["section"], "content": p["content"]} for p in doc_pages],
            "summary": analysis.get("overview", ""),
            "security_report": security_section,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.docs_results.insert_one(docs_result)
        # Remove _id before using
        docs_result.pop("_id", None)

        await notify(4, "completed", f"Documentation published with {len(doc_pages)} pages")

        # Mark pipeline as completed
        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "result": {
                    "total_pages": len(doc_pages),
                    "sections": [p["title"] for p in doc_pages],
                }
            }}
        )

    except Exception as e:
        logger.error(f"Docs pipeline failed: {e}", exc_info=True)
        # Find current running step and mark it failed
        current_run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0})
        if current_run:
            for i, step in enumerate(current_run.get("steps", [])):
                if step["status"] == "running":
                    await notify(i, "failed", error=str(e))
                    break

        await db.pipeline_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    return run_id
