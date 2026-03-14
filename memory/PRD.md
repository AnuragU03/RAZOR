# EngineOps - AI-Native Engineering Operations Platform

## Original Problem Statement
EngineOps takes a GitHub repository and a failing CI log and autonomously ships two results: a live documentation site and a merged bug-fix pull request. Zero human involvement.

## Architecture
- **Frontend**: React + Tailwind CSS + Neubrutalist UI (Public Sans + Space Grotesk fonts)
- **Backend**: FastAPI + MongoDB + Claude AI (via Emergent LLM key) + GitHub REST API
- **Pipelines**: 
  - Docs Pipeline: Code Reader → RAG Writer → Editor → Compiler → Deployer
  - Bugfix Pipeline: Log Parser → Patch Generator → Sandbox Tester → Selector → Merger

## User Personas
1. **Software Team Lead** — Wants to reduce CI failure resolution time
2. **DevOps Engineer** — Wants automated documentation that stays current
3. **Hackathon Judge** — Wants to see real AI-powered analysis in action

## Core Requirements (Static)
- Accept GitHub repo URL + optional token
- Two autonomous pipelines: docs generation and bug fixing
- Real AI integration (Claude Sonnet via Emergent LLM)
- Real GitHub API integration (fetch repos, CI logs, create PRs)
- Real-time pipeline progress via polling
- Beautiful neubrutalist landing page + functional dashboard

## What's Been Implemented (March 14, 2026)
### Backend
- Full REST API with 16+ endpoints
- Project CRUD with GitHub repo validation
- Documentation pipeline (5-step, real AI)
- Bug fix pipeline (5-step, real AI with patch generation)
- SSE streaming for pipeline events
- MongoDB integration for all data persistence
- GitHub service: repo tree, file content, CI logs, branch/PR creation

### Frontend
- Landing page matching exact HTML design (neubrutalist)
- Interactive hero terminal with simulation
- Dashboard with stats + project list
- Project page with docs/bugfix tabs
- Real-time pipeline progress visualization
- Documentation viewer with sidebar navigation
- Bugfix results: root cause analysis, patches with code, confidence bars
- Full navigation flow: Landing → Dashboard → Project → Back

## Testing Results
- Backend: 93% pass rate
- Frontend: 95% pass rate
- All core flows working end-to-end

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (High)
- GitHub token persistence per-user (currently per-project)
- SSE streaming optimization (currently using polling as fallback)
- Docs pipeline optimization for large repos (chunked processing)

### P2 (Medium)
- User authentication/accounts
- Pipeline history with replayable audit trail (S2.dev integration)
- Safedep MCP integration for real dependency scanning
- Gearsec integration for policy-gated merges
- Concierge MCP for Slack/Jira notifications

### P3 (Nice to have)
- Dark mode toggle for dashboard
- Export docs as PDF/site
- Pipeline run comparison view
- Cost tracking per pipeline run

## Next Tasks
1. Integrate S2.dev for agent-to-agent streaming audit trail
2. Add Safedep MCP for real dependency security scanning
3. Optimize docs pipeline for large repos (parallel module processing)
4. Add user auth and project access control
