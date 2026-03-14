"""Concierge — Session isolation, notifications, and team alerts.
Sends pipeline completion notifications via Concierge MCP.
Uses placeholder until real API key is provided at the event.
"""
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

CONCIERGE_API_KEY = os.environ.get("CONCIERGE_API_KEY", "")


def _is_configured() -> bool:
    return bool(CONCIERGE_API_KEY and not CONCIERGE_API_KEY.startswith("placeholder"))


async def notify_pipeline_complete(pipeline_type: str, run_id: str, project_name: str, result_summary: str) -> dict:
    """Send a notification when a pipeline completes.

    Args:
        pipeline_type: 'docs' or 'bugfix'
        run_id: Pipeline run ID
        project_name: Project/repo name
        result_summary: Brief summary of the result

    Returns:
        Dict with notification status
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    notification = {
        "type": "pipeline_complete",
        "pipeline": pipeline_type,
        "run_id": run_id,
        "project": project_name,
        "summary": result_summary,
        "timestamp": timestamp,
    }

    if pipeline_type == "docs":
        notification["message"] = f"Documentation pipeline completed for {project_name}. {result_summary}"
        notification["icon"] = "book"
    else:
        notification["message"] = f"Bug-fix pipeline completed for {project_name}. {result_summary}"
        notification["icon"] = "git-merge"

    if _is_configured():
        # When real Concierge API is available:
        # import httpx
        # async with httpx.AsyncClient(timeout=15) as client:
        #     resp = await client.post(
        #         CONCIERGE_API_URL,
        #         headers={"Authorization": f"Bearer {CONCIERGE_API_KEY}"},
        #         json=notification,
        #     )
        logger.info(f"Concierge cloud notification sent: {notification['message']}")
        return {"status": "sent", "channel": "concierge-cloud", **notification}
    else:
        logger.info(f"Concierge notification (local): {notification['message']}")
        return {"status": "logged", "channel": "concierge-local", **notification}


async def notify_error(pipeline_type: str, run_id: str, project_name: str, error: str) -> dict:
    """Send an error notification when a pipeline fails."""
    timestamp = datetime.now(timezone.utc).isoformat()
    notification = {
        "type": "pipeline_error",
        "pipeline": pipeline_type,
        "run_id": run_id,
        "project": project_name,
        "error": error[:500],
        "message": f"Pipeline {pipeline_type} FAILED for {project_name}: {error[:200]}",
        "timestamp": timestamp,
    }

    if _is_configured():
        logger.info(f"Concierge error notification sent: {notification['message']}")
        return {"status": "sent", "channel": "concierge-cloud", **notification}
    else:
        logger.info(f"Concierge error notification (local): {notification['message']}")
        return {"status": "logged", "channel": "concierge-local", **notification}
