"""Unsiloed Parser — Step 0 in both pipelines.
Scans repo for unstructured files (PDFs, READMEs, docs, CI logs)
and sends them to the Unsiloed API for parsing into structured markdown/JSON.
Uses the official unsiloed_sdk.
"""
import os
import io
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

UNSILOED_API_KEY = os.environ.get("UNSILOED_API_KEY", "")

# File types Unsiloed SDK can actually parse
UNSILOED_SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".pptx", ".xlsx"}
# File patterns for identifying unstructured files (broader for fallback)
UNSTRUCTURED_EXTENSIONS = {".pdf", ".doc", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg"}
UNSTRUCTURED_NAMES = {"README.md", "readme.md", "CHANGELOG.md", "CONTRIBUTING.md", "ARCHITECTURE.md", "DESIGN.md"}

_executor = ThreadPoolExecutor(max_workers=3)


def identify_unstructured_files(file_tree: list[dict]) -> list[str]:
    """Identify unstructured files in the repo tree that Unsiloed should parse."""
    targets = []
    for item in file_tree:
        path = item["path"]
        name = path.split("/")[-1]
        ext = os.path.splitext(name)[1].lower()

        if ext in UNSTRUCTURED_EXTENSIONS:
            targets.append(path)
        elif name in UNSTRUCTURED_NAMES:
            targets.append(path)
        elif "/docs/" in path or "/doc/" in path:
            if ext in {".md", ".txt", ".rst", ".adoc"}:
                targets.append(path)

    return targets[:20]


def _parse_file_sync(file_bytes: bytes, filename: str) -> dict:
    """Synchronous Unsiloed SDK call (runs in thread pool)."""
    from unsiloed_sdk import UnsiloedClient
    from unsiloed_sdk.exceptions import APIError

    try:
        with UnsiloedClient(api_key=UNSILOED_API_KEY) as client:
            # Write bytes to a temp file for the SDK
            import tempfile
            suffix = os.path.splitext(filename)[1] or ".txt"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            try:
                result = client.parse_and_wait(file=tmp_path, merge_tables=True)

                chunks_data = []
                all_markdown = []
                for chunk in result.chunks:
                    embed_text = chunk.get("embed", "")
                    all_markdown.append(embed_text)
                    segments = []
                    for seg in chunk.get("segments", []):
                        segments.append({
                            "type": seg.get("segment_type", ""),
                            "markdown": seg.get("markdown", ""),
                            "content": seg.get("content", ""),
                        })
                    chunks_data.append({"embed": embed_text, "segments": segments})

                return {
                    "status": "parsed",
                    "filename": filename,
                    "total_chunks": result.total_chunks,
                    "chunks": chunks_data,
                    "markdown": "\n\n".join(all_markdown),
                }
            finally:
                os.unlink(tmp_path)

    except APIError as e:
        logger.error(f"Unsiloed API error for {filename}: {e}")
        return {"status": "error", "filename": filename, "error": f"API Error {e.status_code}: {str(e)[:200]}"}
    except Exception as e:
        logger.error(f"Unsiloed parse failed for {filename}: {e}")
        return {"status": "error", "filename": filename, "error": str(e)[:200]}


async def parse_file_with_unsiloed(file_content: bytes, filename: str) -> dict:
    """Send a single file to Unsiloed for parsing (async wrapper)."""
    if not UNSILOED_API_KEY or UNSILOED_API_KEY.startswith("placeholder"):
        return {"status": "skipped", "reason": "Unsiloed API key not configured", "filename": filename}

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _parse_file_sync, file_content, filename)


async def run_unsiloed_parser(file_tree: list[dict], file_contents: dict, ci_log: str = None) -> dict:
    """Run the Unsiloed Parser on identified unstructured files.

    Args:
        file_tree: Repo file tree from GitHub
        file_contents: Dict of path -> content for fetched files
        ci_log: Optional CI log text to parse

    Returns:
        Dict with parsed results and metadata
    """
    targets = identify_unstructured_files(file_tree)
    results = []
    parsed_count = 0

    if not UNSILOED_API_KEY or UNSILOED_API_KEY.startswith("placeholder"):
        logger.info("Unsiloed API key not configured — skipping with graceful fallback")
        for path, content in file_contents.items():
            if path.lower().endswith(".md"):
                results.append({
                    "status": "fallback",
                    "filename": path,
                    "markdown": content[:5000],
                })
                parsed_count += 1

        if ci_log:
            results.append({
                "status": "fallback",
                "filename": "ci_log.txt",
                "markdown": f"# CI Log\n\n```\n{ci_log[:5000]}\n```",
            })
            parsed_count += 1

        return {
            "status": "fallback",
            "message": "Unsiloed API key not available — used local markdown extraction",
            "files_identified": len(targets),
            "files_parsed": parsed_count,
            "results": results,
        }

    # Real Unsiloed SDK integration
    # Only send files with supported extensions to the API
    for path in targets:
        if path in file_contents:
            content = file_contents[path]
            ext = os.path.splitext(path)[1].lower()
            if ext in UNSILOED_SUPPORTED_EXTENSIONS:
                content_bytes = content.encode("utf-8") if isinstance(content, str) else content
                result = await parse_file_with_unsiloed(content_bytes, path)
                results.append(result)
                if result["status"] == "parsed":
                    parsed_count += 1
            else:
                # For .md, .txt, .rst files — extract markdown locally (already text)
                results.append({
                    "status": "local_extract",
                    "filename": path,
                    "markdown": content[:5000] if isinstance(content, str) else content.decode("utf-8", errors="ignore")[:5000],
                })
                parsed_count += 1

    # Also parse CI log if provided
    if ci_log:
        result = await parse_file_with_unsiloed(ci_log.encode("utf-8"), "ci_log.txt")
        results.append(result)
        if result["status"] == "parsed":
            parsed_count += 1

    return {
        "status": "completed",
        "files_identified": len(targets),
        "files_parsed": parsed_count,
        "results": results,
    }
