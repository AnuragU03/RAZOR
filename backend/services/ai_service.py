import os
import logging
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)

API_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def _create_chat(session_id: str, system_message: str) -> LlmChat:
    chat = LlmChat(
        api_key=API_KEY,
        session_id=session_id,
        system_message=system_message,
    )
    chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
    return chat


async def analyze_repo_structure(file_tree: list[dict], key_file_contents: dict, repo_info: dict) -> dict:
    """Analyze repository structure and produce an architectural overview."""
    tree_summary = "\n".join([f"  {f['path']} ({f.get('size', 0)} bytes)" for f in file_tree[:200]])
    files_text = ""
    for path, content in key_file_contents.items():
        files_text += f"\n--- {path} ---\n{content[:3000]}\n"

    chat = _create_chat(
        session_id=f"repo-analysis-{repo_info.get('name', 'unknown')}",
        system_message="""You are a senior software architect. Analyze the repository structure and key files to produce a comprehensive architectural overview. Output valid JSON only with these keys:
- "overview": string, 2-3 paragraph high-level summary
- "architecture": string, description of the architecture patterns used
- "modules": list of {"name": string, "purpose": string, "key_files": list of strings}
- "tech_stack": list of strings (technologies, frameworks, languages)
- "entry_points": list of strings (main entry point files)
- "api_endpoints": list of {"method": string, "path": string, "description": string} (if applicable)
- "data_models": list of {"name": string, "description": string} (if applicable)
- "dependencies": list of strings (key external dependencies)"""
    )

    msg = UserMessage(
        text=f"""Analyze this repository:

Repository: {repo_info.get('full_name', 'unknown')}
Description: {repo_info.get('description', 'N/A')}
Language: {repo_info.get('language', 'N/A')}
Stars: {repo_info.get('stars', 0)}

File tree ({len(file_tree)} files):
{tree_summary}

Key file contents:
{files_text}

Respond with valid JSON only. No markdown formatting."""
    )

    response = await chat.send_message(msg)
    try:
        # Try to parse as JSON
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"overview": response, "modules": [], "tech_stack": [], "entry_points": [], "api_endpoints": [], "data_models": [], "dependencies": [], "architecture": ""}


async def generate_module_docs(module_name: str, module_files: dict, repo_context: str) -> str:
    """Generate documentation for a specific module."""
    files_text = ""
    for path, content in module_files.items():
        files_text += f"\n--- {path} ---\n{content[:4000]}\n"

    chat = _create_chat(
        session_id=f"docs-gen-{module_name}",
        system_message="""You are a technical documentation writer. Generate clear, comprehensive documentation in Markdown format. Include:
- Module overview and purpose
- Key classes/functions with descriptions
- Usage examples where applicable
- API reference if endpoints exist
- Configuration details if applicable
Write for a developer audience. Be precise and practical."""
    )

    msg = UserMessage(
        text=f"""Generate documentation for the "{module_name}" module.

Repository context: {repo_context[:2000]}

Module files:
{files_text}

Write comprehensive Markdown documentation."""
    )

    return await chat.send_message(msg)


async def edit_documentation(raw_docs: str, module_name: str) -> str:
    """Edit and refine generated documentation for clarity and consistency."""
    chat = _create_chat(
        session_id=f"docs-edit-{module_name}",
        system_message="""You are a technical editor. Your job is to:
1. Fix any inaccuracies or unclear passages
2. Ensure consistent formatting (headings, code blocks, lists)
3. Add cross-references between sections where helpful
4. Ensure code examples are syntactically correct
5. Make the writing concise and professional
Return the edited Markdown documentation only."""
    )

    msg = UserMessage(text=f"Edit and refine this documentation:\n\n{raw_docs}")
    return await chat.send_message(msg)


async def generate_overview_doc(repo_info: dict, analysis: dict) -> str:
    """Generate the main overview/index documentation page."""
    chat = _create_chat(
        session_id=f"docs-overview-{repo_info.get('name', 'unknown')}",
        system_message="""You are a technical documentation writer. Generate a comprehensive project overview page in Markdown. This is the landing page for the documentation site. Include:
- Project name and description
- Quick start guide
- Architecture overview
- Technology stack
- Module listing with brief descriptions
- Getting started instructions"""
    )

    msg = UserMessage(
        text=f"""Generate an overview documentation page for:

Repository: {repo_info.get('full_name', '')}
Description: {repo_info.get('description', '')}
Language: {repo_info.get('language', '')}

Architecture analysis:
{json.dumps(analysis, indent=2)[:4000]}

Write comprehensive Markdown documentation."""
    )

    return await chat.send_message(msg)


async def analyze_ci_failure(ci_log: str, repo_context: str, file_contents: dict) -> dict:
    """Parse CI log and trace root cause."""
    files_text = ""
    for path, content in file_contents.items():
        files_text += f"\n--- {path} ---\n{content[:3000]}\n"

    chat = _create_chat(
        session_id="ci-analysis",
        system_message="""You are a senior debugging engineer. Analyze the CI failure log and codebase to identify the root cause. Output valid JSON only with these keys:
- "error_type": string (e.g., "test_failure", "build_error", "lint_error", "type_error")
- "error_message": string (the key error message)
- "failing_file": string (the file where the error originates)
- "failing_line": integer or null (line number if identifiable)
- "failing_function": string or null (function name if identifiable)
- "root_cause": string (2-3 sentence explanation of why it fails)
- "call_chain": list of strings (the call chain leading to the error)
- "suggested_fix_description": string (what needs to change to fix it)"""
    )

    msg = UserMessage(
        text=f"""Analyze this CI failure:

CI Log:
{ci_log[:6000]}

Repository context:
{repo_context[:2000]}

Relevant source files:
{files_text}

Respond with valid JSON only. No markdown formatting."""
    )

    response = await chat.send_message(msg)
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "error_type": "unknown",
            "error_message": response[:500],
            "failing_file": "",
            "root_cause": response,
            "call_chain": [],
            "suggested_fix_description": ""
        }


async def generate_patches(error_analysis: dict, file_contents: dict, repo_context: str) -> list[dict]:
    """Generate candidate patches for the identified bug."""
    files_text = ""
    for path, content in file_contents.items():
        files_text += f"\n--- {path} ---\n{content[:4000]}\n"

    chat = _create_chat(
        session_id="patch-gen",
        system_message="""You are an expert software engineer. Generate exactly 3 candidate patches to fix the identified bug. Output valid JSON only — an array of 3 objects, each with:
- "file_path": string (which file to modify)
- "original_code": string (the exact code snippet to replace — must match the file exactly)
- "patched_code": string (the fixed version of that snippet)
- "explanation": string (1-2 sentences explaining what this patch does and why)
- "confidence": float (0.0 to 1.0, how confident you are this fixes the issue)

Order from most to least confident. Each patch should take a different approach if possible."""
    )

    msg = UserMessage(
        text=f"""Generate 3 candidate patches for this bug:

Error analysis:
{json.dumps(error_analysis, indent=2)}

Source files:
{files_text}

Repository context:
{repo_context[:1500]}

Respond with a valid JSON array only. No markdown formatting."""
    )

    response = await chat.send_message(msg)
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        patches = json.loads(cleaned)
        if isinstance(patches, list):
            return patches[:3]
        return [patches]
    except json.JSONDecodeError:
        return [{
            "file_path": error_analysis.get("failing_file", "unknown"),
            "original_code": "",
            "patched_code": "",
            "explanation": response[:500],
            "confidence": 0.5
        }]


async def evaluate_patches(patches: list[dict], error_analysis: dict, file_contents: dict) -> int:
    """Evaluate patches and select the best one. Returns the index of the best patch."""
    chat = _create_chat(
        session_id="patch-eval",
        system_message="""You are a code review expert. Evaluate the candidate patches and select the best one. Consider:
1. Correctness — does it actually fix the root cause?
2. Safety — does it introduce any regressions?
3. Minimality — is it the smallest safe change?
4. Code quality — does it follow the codebase conventions?

Respond with a single integer: the 0-based index of the best patch. Nothing else."""
    )

    files_text = ""
    for path, content in file_contents.items():
        files_text += f"\n--- {path} ---\n{content[:2000]}\n"

    msg = UserMessage(
        text=f"""Select the best patch:

Error analysis:
{json.dumps(error_analysis, indent=2)}

Candidate patches:
{json.dumps(patches, indent=2)}

Source context:
{files_text}

Respond with just the index number (0, 1, or 2)."""
    )

    response = await chat.send_message(msg)
    try:
        idx = int(response.strip())
        return min(idx, len(patches) - 1)
    except (ValueError, IndexError):
        return 0


async def generate_pr_description(error_analysis: dict, selected_patch: dict) -> str:
    """Generate a PR title and description."""
    chat = _create_chat(
        session_id="pr-desc",
        system_message="You are a developer writing a pull request description. Be concise and clear. Output valid JSON with keys 'title' (string, max 72 chars) and 'body' (string, markdown formatted PR description with sections: Summary, Root Cause, Fix, Testing Notes)."
    )

    msg = UserMessage(
        text=f"""Write a PR description for this bug fix:

Error: {json.dumps(error_analysis, indent=2)[:2000]}
Patch: {json.dumps(selected_patch, indent=2)[:2000]}

Respond with valid JSON only."""
    )

    response = await chat.send_message(msg)
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "title": f"fix: resolve {error_analysis.get('error_type', 'bug')} in {error_analysis.get('failing_file', 'code')}",
            "body": response
        }
