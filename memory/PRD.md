# EngineOps — AI-Native Engineering Operations

## Problem Statement
EngineOps takes a GitHub repository and a failing CI run and returns two shipped outcomes:
1. A live documentation site
2. A validated bug-fix pull request

## Architecture
- **Backend:** FastAPI + MongoDB + Server-Sent Events (SSE)
- **Frontend:** React + Tailwind CSS (Neubrutalism dark theme)
- **AI:** Claude 4 Sonnet via Emergent LLM Key (model: claude-4-sonnet-20250514)
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

## What's Implemented

### Real End-to-End Pipeline (Verified on AnuragU03/STT repo)
- **Docs pipeline**: All 8/8 steps completed — 5 pages generated, 37 deps scanned
- **Bugfix pipeline**: All 8/8 steps completed — 3 real PRs created (#9, #10, #11)
- **S2.dev audit trail**: 16 records per pipeline run (verified working)
- **Gearsec policy gate**: PASSED with 0 violations
- **Safedep security scan**: 37 dependencies scanned
- **Unsiloed parsing**: 2 unstructured files indexed per run

### Partner Integrations
- **Unsiloed** — Real SDK (unsiloed_sdk), real API key, parses PDFs and text docs
- **Safedep** — Real API, dependency extraction + vulnerability scanning
- **S2.dev** — Real StreamStore (PUT/POST/GET streams), verified audit trail
- **Gearsec** — Local policy engine (placeholder for cloud API, get key at event)
- **Concierge** — Local notification logging (placeholder, get key at event)

### Features
- One-Click Demo mode
- GitHub token auth (session-stored)
- Partner status bar in dashboard
- Replay Run button linking to S2.dev audit trail
- Partner badges on pipeline results
- AI model: Claude 4 Sonnet (claude-4-sonnet-20250514) with timeout/retry logic

## Credentials
- EMERGENT_LLM_KEY: Configured
- UNSILOED_API_KEY: Real key
- SAFEDEP_CLOUD_API_KEY: Real key
- S2_ACCESS_TOKEN: Real key, verified working
- GEARSEC_API_KEY: Placeholder (get at event)
- CONCIERGE_API_KEY: Placeholder (get at event)
- GitHub Token: User-provided per session
