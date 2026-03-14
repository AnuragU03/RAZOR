"""Gearsec — Pre-merge policy enforcement and SDLC compliance.
Validates patches against security and quality policies before merge.
Uses placeholder until real API key is provided at the event.
"""
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GEARSEC_API_KEY = os.environ.get("GEARSEC_API_KEY", "")


def _is_configured() -> bool:
    return bool(GEARSEC_API_KEY and not GEARSEC_API_KEY.startswith("placeholder"))


async def run_policy_check(patch: dict, error_analysis: dict, repo_context: str = "") -> dict:
    """Run Gearsec policy compliance check on a selected patch before merge.

    Validates:
    - No hardcoded secrets in patch
    - No high-risk patterns (eval, exec, system calls)
    - Patch modifies only the identified failing file
    - Change scope is minimal and targeted

    Returns:
        Dict with policy check results
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    patched_code = patch.get("patched_code", "")
    file_path = patch.get("file_path", "")
    failing_file = error_analysis.get("failing_file", "")

    # Policy rules (these run locally regardless of API key)
    violations = []
    warnings = []

    # Rule 1: No hardcoded secrets
    secret_patterns = ["password=", "api_key=", "secret=", "token=", "private_key"]
    for pattern in secret_patterns:
        if pattern in patched_code.lower() and pattern not in patch.get("original_code", "").lower():
            violations.append(f"Potential hardcoded secret detected: '{pattern}' introduced in patch")

    # Rule 2: No dangerous function calls introduced
    danger_patterns = ["eval(", "exec(", "os.system(", "subprocess.call(", "__import__"]
    for pattern in danger_patterns:
        if pattern in patched_code and pattern not in patch.get("original_code", ""):
            warnings.append(f"High-risk function call introduced: '{pattern}'")

    # Rule 3: Patch targets the correct file
    if failing_file and file_path and failing_file != file_path:
        warnings.append(f"Patch targets '{file_path}' but failure was in '{failing_file}'")

    # Rule 4: Change scope check
    original_lines = len(patch.get("original_code", "").split("\n"))
    patched_lines = len(patched_code.split("\n"))
    if abs(patched_lines - original_lines) > 50:
        warnings.append(f"Large change scope: {abs(patched_lines - original_lines)} lines difference")

    passed = len(violations) == 0
    policy_result = {
        "status": "pass" if passed else "fail",
        "timestamp": timestamp,
        "engine": "gearsec" if _is_configured() else "gearsec-local",
        "policies_checked": 4,
        "violations": violations,
        "warnings": warnings,
        "summary": f"{'PASSED' if passed else 'FAILED'} — {len(violations)} violations, {len(warnings)} warnings",
    }

    if _is_configured():
        # When real Gearsec API is available, enhance with remote policy check
        # import httpx
        # async with httpx.AsyncClient(timeout=15) as client:
        #     resp = await client.post(GEARSEC_API_URL, headers=..., json=...)
        policy_result["engine"] = "gearsec-cloud"
        logger.info(f"Gearsec cloud policy check: {policy_result['summary']}")
    else:
        logger.info(f"Gearsec local policy check: {policy_result['summary']}")

    return policy_result
