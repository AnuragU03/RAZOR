# EngineOps — AI-Native Engineering Operations

## Problem Statement
EngineOps takes a GitHub repository and a failing CI run and returns two shipped outcomes:
1. A live documentation site
2. A validated bug-fix pull request

## Architecture
- **Backend:** FastAPI + MongoDB + Server-Sent Events (SSE)
- **Frontend:** React + Tailwind CSS (Neubrutalism dark theme)
- **AI:** Claude Sonnet 4.5 via Emergent LLM Key
- **Integrations:** GitHub API, Unsiloed SDK, Safedep Cloud, S2.dev StreamStore, Gearsec, Concierge

## Pipeline Architecture (8 Steps Each)

### Documentation Pipeline
0. **Unsiloed Parser** — Parse PDFs, READMEs, unstructured docs via Unsiloed SDK
1. **Code Reader** — Build Code Property Graph from source files
2. **RAG Writer** — Query ChromaDB (code + unstructured context) to generate docs
3. **Editor** — Clarity and consistency pass via AI
4. **Safedep MCP** — Dependency security scan, append Security section
5. **Compiler** — Build static documentation structure
6. **Deployer** — Publish documentation
7. **Concierge** — Team notification

### Bug-Fix Pipeline
0. **Unsiloed Parser** — Parse CI log and unstructured repo files
1. **Log Parser** — Trace root cause via CPG
2. **Patch Generator** — Generate 3 candidate patches using RAG context
3. **Sandbox Tester** — Test each patch
4. **Selector** — Pick passing patch
5. **Gearsec MCP** — Pre-merge policy compliance check
6. **Merger** — Create PR via GitHub API
7. **Concierge** — Team notification with PR link

## What's Implemented (as of 2026-03-14)

### P0 — Partner MCP Integrations (DONE)
- **Unsiloed** — Real SDK integration (unsiloed_sdk), API key configured, parses PDFs and text docs
- **Safedep** — Dependency extraction + Cloud API scanning for vulnerabilities
- **S2.dev** — REAL stream creation, record append, and read via REST API (s2://razortest/run-{id})
- **Gearsec** — Local policy engine checking for secrets, dangerous patterns, change scope (placeholder for cloud API)
- **Concierge** — Local notification logging (placeholder for cloud API)
- **/api/mcp** endpoint — MCP server registration for Concierge
- **/api/partner-status** endpoint — Shows which partners are configured
- Partner badge display in dashboard and pipeline results

### P1 — One-Click Demo Mode (DONE)
- POST /api/demo creates Flask project with pre-populated CI failure log
- Triggers both docs + bugfix pipelines simultaneously
- Dashboard has prominent ONE-CLICK DEMO button

### P2 — GitHub Token Auth (DONE)
- Session-stored GitHub token input in dashboard header
- Token passed to project creation for private repos and PR creation

### Core Features (DONE)
- Full-stack app with FastAPI backend + React frontend
- Real Claude AI integration for code analysis, patch generation, documentation
- GitHub API integration for repo fetching, file content, tree analysis
- Project CRUD with MongoDB persistence
- 8-step pipeline visualization with real-time SSE updates
- Bugfix pipeline: root cause analysis, 3 candidate patches, confidence scores
- S2.dev audit trail with Replay Run button
- Neubrutalism dark theme with animations

## Key API Endpoints
- POST /api/projects — Create project from GitHub URL
- POST /api/demo — One-click demo with Flask repo
- POST /api/projects/{id}/run-docs — Trigger docs pipeline
- POST /api/projects/{id}/run-bugfix — Trigger bugfix pipeline
- GET /api/projects/{id}/pipeline-runs — List pipeline runs
- GET /api/pipeline-runs/{id}/audit-trail — S2.dev audit trail
- GET /api/pipeline-runs/{id}/replay — Full S2 stream replay
- GET /api/partner-status — Partner integration status
- POST /api/mcp — MCP server endpoint for Concierge

## Credentials
- EMERGENT_LLM_KEY: Configured
- UNSILOED_API_KEY: Real key configured
- SAFEDEP_CLOUD_API_KEY: Real key configured
- S2_ACCESS_TOKEN: Real key, verified working
- GEARSEC_API_KEY: Placeholder (get at event)
- CONCIERGE_API_KEY: Placeholder (get at event)

## Known Issues
- Docs pipeline can fail on very large repos (e.g., Flask) due to Claude API timeouts
- Gearsec and Concierge use local/placeholder implementations until real keys provided

## Test Results
- Backend: 100% pass rate
- Frontend: 95% pass rate
- S2.dev audit trail: Verified with 16 records for completed bugfix run
