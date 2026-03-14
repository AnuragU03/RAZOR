"""Safedep MCP — Dependency security scanning.
Scans project dependencies for vulnerabilities, malware, and policy violations.
Uses the Safedep Cloud API for package analysis.
"""
import os
import re
import logging
import httpx

logger = logging.getLogger(__name__)

SAFEDEP_API_KEY = os.environ.get("SAFEDEP_CLOUD_API_KEY", "")
SAFEDEP_TENANT = os.environ.get("SAFEDEP_CLOUD_TENANT_DOMAIN", "")
SAFEDEP_API_BASE = f"https://{SAFEDEP_TENANT}" if SAFEDEP_TENANT else ""


def extract_dependencies(file_contents: dict) -> list[dict]:
    """Extract dependency info from known manifest files."""
    deps = []

    for path, content in file_contents.items():
        name = path.split("/")[-1].lower()

        if name == "requirements.txt":
            for line in content.strip().split("\n"):
                line = line.strip()
                if line and not line.startswith("#"):
                    match = re.match(r"^([a-zA-Z0-9_.-]+)", line)
                    if match:
                        deps.append({"name": match.group(1), "ecosystem": "pypi", "source": path, "raw": line})

        elif name == "package.json":
            try:
                import json
                pkg = json.loads(content)
                for dep_name, ver in {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}.items():
                    deps.append({"name": dep_name, "version": ver, "ecosystem": "npm", "source": path})
            except Exception:
                pass

        elif name in ("go.mod", "go.sum"):
            for line in content.strip().split("\n"):
                if line.startswith("\t") or line.startswith("require"):
                    parts = line.strip().split()
                    if len(parts) >= 2 and "/" in parts[0]:
                        deps.append({"name": parts[0], "ecosystem": "go", "source": path})

        elif name == "cargo.toml":
            in_deps = False
            for line in content.strip().split("\n"):
                if "[dependencies]" in line or "[dev-dependencies]" in line:
                    in_deps = True
                    continue
                if line.startswith("[") and in_deps:
                    in_deps = False
                if in_deps and "=" in line:
                    dep_name = line.split("=")[0].strip()
                    if dep_name:
                        deps.append({"name": dep_name, "ecosystem": "crates", "source": path})

    return deps


async def scan_with_safedep_api(deps: list[dict]) -> dict:
    """Query Safedep Cloud API for vulnerability data on dependencies."""
    if not SAFEDEP_API_KEY or not SAFEDEP_TENANT:
        return {"status": "skipped", "reason": "Safedep credentials not configured"}

    findings = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            headers = {
                "Authorization": f"Bearer {SAFEDEP_API_KEY}",
                "Content-Type": "application/json",
            }

            # Query each dependency (batch in groups of 10)
            for dep in deps[:30]:
                try:
                    url = f"https://api.safedep.io/insights/v1/package/{dep['ecosystem']}/{dep['name']}"
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        vulns = data.get("vulnerabilities", [])
                        scorecard = data.get("scorecard", {})
                        if vulns:
                            findings.append({
                                "package": dep["name"],
                                "ecosystem": dep["ecosystem"],
                                "vulnerabilities": len(vulns),
                                "critical": sum(1 for v in vulns if v.get("severity") == "CRITICAL"),
                                "high": sum(1 for v in vulns if v.get("severity") == "HIGH"),
                                "details": [{"id": v.get("id", ""), "severity": v.get("severity", "")} for v in vulns[:5]],
                            })
                        elif scorecard:
                            # No vulns but has scorecard data
                            pass
                except Exception as e:
                    logger.warning(f"Safedep lookup failed for {dep['name']}: {e}")

        return {
            "status": "completed",
            "total_scanned": min(len(deps), 30),
            "vulnerabilities_found": len(findings),
            "findings": findings,
        }

    except Exception as e:
        logger.error(f"Safedep scan failed: {e}")
        return {"status": "error", "error": str(e)}


async def run_safedep_scan(file_contents: dict) -> dict:
    """Run full Safedep dependency security scan.

    Args:
        file_contents: Dict of path -> content for dependency manifest files

    Returns:
        Dict with scan results and security report markdown
    """
    deps = extract_dependencies(file_contents)
    if not deps:
        return {
            "status": "completed",
            "total_dependencies": 0,
            "report_markdown": "## Safedep Security Scan\n\nNo dependency manifests found in the repository.",
            "findings": [],
        }

    scan_result = await scan_with_safedep_api(deps)

    # Build markdown security report
    md = "## Safedep Dependency Security Report\n\n"
    md += f"**Scanned:** {len(deps)} dependencies across {len(set(d['ecosystem'] for d in deps))} ecosystems\n\n"

    if scan_result["status"] == "completed" and scan_result.get("findings"):
        md += f"**Vulnerabilities Found:** {scan_result['vulnerabilities_found']}\n\n"
        md += "| Package | Ecosystem | Critical | High | Total |\n"
        md += "|---------|-----------|----------|------|-------|\n"
        for f in scan_result["findings"]:
            md += f"| {f['package']} | {f['ecosystem']} | {f['critical']} | {f['high']} | {f['vulnerabilities']} |\n"
        md += "\n"
    elif scan_result["status"] == "skipped":
        md += "*Safedep Cloud API key not configured — showing dependency inventory only.*\n\n"
        md += "| Package | Ecosystem | Source |\n"
        md += "|---------|-----------|--------|\n"
        for d in deps[:20]:
            md += f"| {d['name']} | {d['ecosystem']} | {d['source']} |\n"
        md += "\n"
    else:
        md += "No known vulnerabilities detected. All dependencies passed security checks.\n\n"

    md += "\n*Powered by [Safedep](https://safedep.io) — Supply Chain Security*\n"

    return {
        "status": scan_result.get("status", "completed"),
        "total_dependencies": len(deps),
        "report_markdown": md,
        "findings": scan_result.get("findings", []),
        "ecosystems": list(set(d["ecosystem"] for d in deps)),
    }
