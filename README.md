# RAZOR (EngineOps) — AI‑Native Engineering Operations

EngineOps (in this repo) is a full‑stack application that takes a GitHub repository (optionally with a failing CI run/log) and produces two “shipped” outcomes:

1. **Documentation Pipeline** — generates structured documentation (including a dependency security section) and can publish it as a PR.
2. **Bug‑Fix Pipeline** — analyzes a CI failure, generates candidate patches, validates them, and can open a bug‑fix PR.

The system is built to be **AI‑native** (LLM-driven reasoning), **observable** (step-by-step streaming updates), and **auditable** (durable run replay).

---

## Key Features

- **Full-stack app**
  - **Backend:** FastAPI + MongoDB + Server‑Sent Events (SSE)
  - **Frontend:** React (Create React App) + CRACO + Tailwind CSS
- **Real-time pipeline UI**
  - 8-step pipelines visualized with statuses (`pending`, `running`, `completed`, `failed`)
  - Streaming updates via SSE for live progress
- **Partner-style integrations**
  - **Unsiloed**: parses unstructured files (PDF/DOC/PPT/XLS + fallback for markdown)
  - **Safedep**: dependency extraction + vulnerability insights + “Security” section in docs
  - **S2.dev**: durable audit trail + replay support
  - **Gearsec**: policy checks (local rules; cloud placeholder)
  - **Concierge**: notifications (local placeholder; cloud placeholder)
- **GitHub automation**
  - Reads repo structure + key files via GitHub API
  - Can create branches / commits / PRs as part of pipelines (when configured)

---

## Architecture Overview

### Backend (FastAPI)
- Serves a REST API under `/api`
- Persists Projects and Pipeline Runs in **MongoDB**
- Streams pipeline step events through **SSE`
- Exposes endpoints for:
  - creating projects from repo URLs
  - running pipelines (docs / bugfix)
  - listing pipeline runs
  - audit trail + replay (S2.dev)

### Frontend (React)
- Routes:
  - `/` Landing
  - `/dashboard` Dashboard
  - `/dashboard/project/:projectId` Project detail + pipeline visualization

---

## Pipelines (8 Steps)

### Documentation Pipeline
0. **Unsiloed Parser** — parse docs/unstructured files into structured text
1. **Code Reader** — build code understanding (CPG-like context)
2. **RAG Writer** — generate documentation pages
3. **Editor** — clarity/consistency pass
4. **Safedep MCP** — dependency security scan → add “Security” section
5. **Compiler** — compile structured docs output
6. **Deployer** — store/publish results (and/or PR flow depending on configuration)
7. **Concierge** — notify completion

### Bug‑Fix Pipeline
0. **Unsiloed Parser** — parse CI logs + docs context
1. **Log Parser** — identify root cause and failing file/area
2. **Patch Generator** — generate multiple candidate patches
3. **Sandbox Tester** — test candidates
4. **Selector** — choose best passing patch
5. **Gearsec MCP** — policy compliance checks (secrets, risky calls, scope)
6. **Merger** — create PR via GitHub
7. **Concierge** — notify completion

---

## Tech Stack

**Backend**
- Python + FastAPI
- MongoDB (via `motor`)
- SSE streaming
- Integrations: GitHub API, Unsiloed SDK, Safedep Cloud, S2.dev streams
- LLM integration via `emergentintegrations` (model configured in code)

**Frontend**
- React (CRA)
- CRACO
- Tailwind CSS + utility helpers
- Axios
- React Router

---

## Project Structure

```text
.
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── models/
│   └── services/
├── frontend/
│   ├── package.json
│   └── src/
├── memory/
│   └── PRD.md
└── README.md
```

---

## Getting Started (Local Development)

### Prerequisites
- **Node.js** (recommended: LTS)
- **Yarn** (frontend `packageManager` indicates Yarn 1.x)
- **Python 3.10+** (recommended)
- **MongoDB** instance (local or hosted)

---

## Backend Setup

### 1) Install dependencies
```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows (PowerShell)
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 2) Configure environment variables
Backend expects at least:

**Required**
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — database name

**Common / Optional (feature-dependent)**
- `CORS_ORIGINS` — comma-separated origins (default falls back to `*`)
- `EMERGENT_LLM_KEY` — LLM key used by the AI service
- `UNSILOED_API_KEY` — enables real parsing; otherwise fallback mode
- `SAFEDEP_CLOUD_API_KEY`, `SAFEDEP_CLOUD_TENANT_DOMAIN` — enables Safedep lookups
- `S2_ACCESS_TOKEN`, `S2_BASIN` — enables audit trail storage/replay
- `GEARSEC_API_KEY` — placeholder supported (local rules still run)
- `CONCIERGE_API_KEY` — placeholder supported (local logging still runs)

> Note: If partner keys are missing, the app generally degrades gracefully (skips or uses local placeholder logic).

### 3) Run the API
From `backend/`, run FastAPI using uvicorn (example):
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

API base:
- `http://localhost:8000/api`

---

## Frontend Setup

### 1) Install dependencies
```bash
cd frontend
yarn install
```

### 2) Start dev server
```bash
yarn start
```

Frontend default:
- `http://localhost:3000`

---

## API Highlights

- `GET /api/` — basic service status
- `GET /api/health` — health check
- `GET /api/partner-status` — shows which integrations are configured
- `GET /api/pipeline-runs/{run_id}/audit-trail` — audit trail summary (S2.dev)
- `GET /api/pipeline-runs/{run_id}/replay` — replay run events

(Additional project/pipeline endpoints exist for creating projects and triggering runs.)

---

## Security Notes

- Do **not** commit secrets (API keys, tokens, Mongo URLs) into the repo.
- Gearsec includes local policy checks to detect common secret patterns and risky calls in patches before PR creation.
- Safedep integration can generate a dependency security report when configured.

---

## Contributing

1. Fork the repo and create a feature branch
2. Keep changes small and focused
3. Add/adjust tests where applicable
4. Open a PR with a clear description (what / why / how)

---

## License

Add your license here (e.g., MIT). If this repository is private or unlicensed, state the usage terms explicitly.
