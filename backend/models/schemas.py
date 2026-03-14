from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


# --- Project Models ---
class ProjectCreate(BaseModel):
    repo_url: str
    github_token: Optional[str] = None

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    repo_url: str
    repo_owner: str = ""
    repo_name: str = ""
    github_token: Optional[str] = None
    status: str = "active"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_docs_run: Optional[str] = None
    last_bugfix_run: Optional[str] = None


# --- Pipeline Step ---
class PipelineStep(BaseModel):
    name: str
    agent: str
    status: str = "pending"  # pending, running, completed, failed
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None


# --- Pipeline Run ---
class PipelineRunCreate(BaseModel):
    ci_log: Optional[str] = None

class PipelineRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    pipeline_type: str  # "docs" or "bugfix"
    status: str = "pending"  # pending, running, completed, failed
    steps: List[dict] = Field(default_factory=list)
    ci_log: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    result: Optional[dict] = None


# --- Documentation Result ---
class DocPage(BaseModel):
    title: str
    section: str
    content: str  # markdown

class DocsResult(BaseModel):
    project_id: str
    pipeline_run_id: str
    pages: List[dict] = Field(default_factory=list)
    summary: str = ""
    security_report: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# --- Bug Fix Result ---
class PatchCandidate(BaseModel):
    file_path: str
    original_code: str
    patched_code: str
    explanation: str
    test_result: Optional[str] = None  # pass/fail/untested

class BugFixResult(BaseModel):
    project_id: str
    pipeline_run_id: str
    ci_log_summary: str = ""
    root_cause: str = ""
    patches: List[dict] = Field(default_factory=list)
    selected_patch_index: Optional[int] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# --- API Response Models ---
class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    repo_url: str
    repo_owner: str
    repo_name: str
    status: str
    created_at: str
    last_docs_run: Optional[str] = None
    last_bugfix_run: Optional[str] = None

class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    pipeline_type: str
    status: str
    steps: List[dict]
    ci_log: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    result: Optional[dict] = None
