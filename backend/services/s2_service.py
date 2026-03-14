"""S2.dev — Durable agent-to-agent streaming and audit trail.
Every pipeline step appends output to an S2 stream keyed by run ID.
Supports replay via read endpoint.
"""
import os
import json
import base64
import logging
from datetime import datetime, timezone
import httpx

logger = logging.getLogger(__name__)

S2_ACCESS_TOKEN = os.environ.get("S2_ACCESS_TOKEN", "")
S2_BASIN = os.environ.get("S2_BASIN", "razortest")
S2_API_BASE = f"https://{S2_BASIN}.b.aws.s2.dev/v1"
S2_ACCOUNT_API = "https://aws.s2.dev"


def _s2_headers() -> dict:
    return {
        "Authorization": f"Bearer {S2_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }


def _is_configured() -> bool:
    return bool(S2_ACCESS_TOKEN and not S2_ACCESS_TOKEN.startswith("placeholder"))


async def ensure_stream(run_id: str) -> bool:
    """Create a stream for a pipeline run if it doesn't exist. Uses PUT."""
    if not _is_configured():
        return False

    stream_name = f"run-{run_id}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            url = f"{S2_API_BASE}/streams/{stream_name}"
            resp = await client.put(url, headers=_s2_headers(), json={})
            if resp.status_code in (200, 201, 409):
                logger.info(f"S2 stream ready: s2://{S2_BASIN}/{stream_name}")
                return True
            logger.warning(f"S2 create stream returned {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        logger.warning(f"S2 ensure_stream failed: {e}")
        return False


async def append_step_output(run_id: str, step_index: int, step_name: str, status: str, output: str = None, error: str = None) -> bool:
    """Append a pipeline step's output to the S2 stream."""
    if not _is_configured():
        return False

    stream_name = f"run-{run_id}"
    record = {
        "run_id": run_id,
        "step_index": step_index,
        "step_name": step_name,
        "status": status,
        "output": (output or "")[:2000],
        "error": error,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            url = f"{S2_API_BASE}/streams/{stream_name}/records"
            body_b64 = base64.b64encode(json.dumps(record).encode()).decode()
            body = {"records": [{"headers": [], "body": body_b64}]}
            headers = {**_s2_headers(), "s2-format": "base64"}
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code in (200, 201):
                return True
            logger.warning(f"S2 append returned {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        logger.warning(f"S2 append failed: {e}")
        return False


async def read_stream(run_id: str) -> list[dict]:
    """Read all records from a pipeline run's S2 stream for replay."""
    if not _is_configured():
        return []

    stream_name = f"run-{run_id}"
    records = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            url = f"{S2_API_BASE}/streams/{stream_name}/records"
            headers = {**_s2_headers(), "s2-format": "base64"}
            resp = await client.get(url, headers=headers, params={"seq_num": 0, "count": 100})
            if resp.status_code == 200:
                data = resp.json()
                for rec in data.get("records", []):
                    try:
                        body_b64 = rec.get("body", "")
                        body_bytes = base64.b64decode(body_b64)
                        parsed = json.loads(body_bytes)
                        records.append(parsed)
                    except Exception:
                        records.append({"raw": str(rec)})
            else:
                logger.warning(f"S2 read returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"S2 read failed: {e}")

    return records


async def get_audit_summary(run_id: str) -> dict:
    """Get a summary of the audit trail for a pipeline run."""
    records = await read_stream(run_id)
    if not records:
        return {
            "available": _is_configured(),
            "run_id": run_id,
            "total_steps": 0,
            "records": [],
        }

    return {
        "available": True,
        "run_id": run_id,
        "stream": f"s2://{S2_BASIN}/run-{run_id}",
        "total_steps": len(records),
        "records": records,
    }
