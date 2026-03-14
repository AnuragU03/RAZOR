# EngineOps — AI-Native Engineering Operations

## Problem Statement
EngineOps takes a GitHub repository and a failing CI run and returns two shipped outcomes:
1. A live documentation site (pushed as PR to repo)
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
2. **RAG Writer** — Generate documentation pages via Claude AI
3. **Editor** — Clarity and consistency pass via AI
4. **Safedep MCP** — Dependency security scan, append Security section
5. **Compiler** — Build static documentation structure
6. **Deployer** — Create branch, commit docs to `docs/` folder, open PR on GitHub
7. **Concierge** — Team notification with PR link

### Bug-Fix Pipeline
0. **Unsiloed Parser** — Parse CI log and unstructured repo files
1. **Log Parser** — Trace root cause via CPG
2. **Patch Generator** — Generate 3 candidate patches
3. **Sandbox Tester** — Test each patch
4. **Selector** — Pick passing patch
5. **Gearsec MCP** — Pre-merge policy compliance check
6. **Merger** — Create branch, commit fix, open PR on GitHub
7. **Concierge** — Team notification with PR link

## Real Results on AnuragU03/STT
- **Docs PR**: https://github.com/AnuragU03/STT/pull/12 (5 pages)
- **Bugfix PRs**: #9, #10, #11 (3 different fix strategies)
- **S2.dev audit trail**: 16 records per pipeline run
- **All partner integrations working end-to-end**

## Credentials
- EMERGENT_LLM_KEY: Configured
- UNSILOED_API_KEY: Real key
- SAFEDEP_CLOUD_API_KEY: Real key
- S2_ACCESS_TOKEN: Real key, verified
- GEARSEC_API_KEY: Placeholder (get at event)
- CONCIERGE_API_KEY: Placeholder (get at event)
- GitHub Token: User-provided per session
