import httpx
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _headers(token: Optional[str] = None) -> dict:
    h = {"Accept": "application/vnd.github.v3+json"}
    if token:
        h["Authorization"] = f"token {token}"
    return h


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract owner and repo name from a GitHub URL."""
    url = repo_url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    parts = url.split("/")
    owner = parts[-2]
    repo = parts[-1]
    return owner, repo


async def fetch_repo_tree(owner: str, repo: str, token: Optional[str] = None, branch: str = "main") -> dict:
    """Fetch the full file tree of a repo."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Try main first, then master
        for ref in [branch, "master"]:
            url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{ref}?recursive=1"
            resp = await client.get(url, headers=_headers(token))
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "branch": ref,
                    "tree": [
                        {"path": item["path"], "type": item["type"], "size": item.get("size", 0)}
                        for item in data.get("tree", [])
                        if item["type"] == "blob"
                    ],
                    "total_files": len([i for i in data.get("tree", []) if i["type"] == "blob"])
                }
        raise Exception(f"Could not fetch tree for {owner}/{repo}. Status: {resp.status_code}")


async def fetch_file_content(owner: str, repo: str, path: str, token: Optional[str] = None, branch: str = "main") -> str:
    """Fetch content of a single file."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code != 200:
            raise Exception(f"Could not fetch {path}: {resp.status_code}")
        data = resp.json()
        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return data.get("content", "")


async def fetch_multiple_files(owner: str, repo: str, paths: list[str], token: Optional[str] = None, branch: str = "main") -> dict:
    """Fetch content of multiple files."""
    results = {}
    async with httpx.AsyncClient(timeout=30) as client:
        for path in paths:
            try:
                url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}?ref={branch}"
                resp = await client.get(url, headers=_headers(token))
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("encoding") == "base64":
                        results[path] = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                    else:
                        results[path] = data.get("content", "")
            except Exception as e:
                logger.warning(f"Failed to fetch {path}: {e}")
    return results


async def fetch_repo_info(owner: str, repo: str, token: Optional[str] = None) -> dict:
    """Fetch basic repo metadata."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}"
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code != 200:
            raise Exception(f"Could not fetch repo info: {resp.status_code}")
        data = resp.json()
        return {
            "name": data["name"],
            "full_name": data["full_name"],
            "description": data.get("description", ""),
            "language": data.get("language", ""),
            "default_branch": data.get("default_branch", "main"),
            "stars": data.get("stargazers_count", 0),
            "forks": data.get("forks_count", 0),
            "open_issues": data.get("open_issues_count", 0),
            "topics": data.get("topics", []),
        }


async def fetch_ci_workflow_runs(owner: str, repo: str, token: Optional[str] = None, status: str = "failure") -> list:
    """Fetch recent CI workflow runs, optionally filtered by status."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs?status={status}&per_page=10"
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code != 200:
            return []
        data = resp.json()
        return [
            {
                "id": run["id"],
                "name": run.get("name", ""),
                "status": run["status"],
                "conclusion": run.get("conclusion", ""),
                "created_at": run["created_at"],
                "html_url": run["html_url"],
                "head_branch": run.get("head_branch", ""),
            }
            for run in data.get("workflow_runs", [])
        ]


async def fetch_ci_run_logs(owner: str, repo: str, run_id: int, token: Optional[str] = None) -> str:
    """Fetch logs for a specific CI run. Returns log text."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        # Get jobs for this run
        url = f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code != 200:
            return f"Could not fetch jobs: {resp.status_code}"

        jobs = resp.json().get("jobs", [])
        logs = []
        for job in jobs:
            job_id = job["id"]
            log_url = f"{GITHUB_API}/repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
            log_resp = await client.get(log_url, headers=_headers(token))
            if log_resp.status_code == 200:
                logs.append(f"=== Job: {job.get('name', 'unknown')} ===\n{log_resp.text[:5000]}")

        return "\n\n".join(logs) if logs else "No logs available"


async def create_branch(owner: str, repo: str, branch_name: str, token: str, base_branch: str = "main") -> bool:
    """Create a new branch from base."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Get the SHA of the base branch
        ref_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{base_branch}"
        ref_resp = await client.get(ref_url, headers=_headers(token))
        if ref_resp.status_code != 200:
            raise Exception(f"Could not get ref for {base_branch}: {ref_resp.status_code}")

        sha = ref_resp.json()["object"]["sha"]

        # Create new branch
        create_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/refs"
        resp = await client.post(
            create_url,
            headers=_headers(token),
            json={"ref": f"refs/heads/{branch_name}", "sha": sha}
        )
        return resp.status_code == 201


async def commit_file(owner: str, repo: str, path: str, content: str, branch: str, message: str, token: str) -> bool:
    """Create or update a file in the repo."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"

        # Check if file exists to get its SHA
        check_resp = await client.get(url + f"?ref={branch}", headers=_headers(token))
        payload = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch,
        }
        if check_resp.status_code == 200:
            payload["sha"] = check_resp.json()["sha"]

        resp = await client.put(url, headers=_headers(token), json=payload)
        return resp.status_code in (200, 201)


async def create_pull_request(owner: str, repo: str, title: str, body: str, head: str, base: str, token: str) -> dict:
    """Create a pull request."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls"
        resp = await client.post(
            url,
            headers=_headers(token),
            json={
                "title": title,
                "body": body,
                "head": head,
                "base": base,
            }
        )
        if resp.status_code == 201:
            data = resp.json()
            return {
                "number": data["number"],
                "url": data["html_url"],
                "state": data["state"],
            }
        raise Exception(f"Could not create PR: {resp.status_code} - {resp.text}")
