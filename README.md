# Resume Roast Arena

MVP agent layer for a roast-style resume improvement app.

This repo currently contains reusable LangChain + OpenAI agents only. UI, upload parsing, auth, persistence, and LaTeX resume generation are intentionally left out.

## Setup

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
```

Add your key to `.env`:

```text
OPENAI_API_KEY=sk-your-key-here
```

## Test API Key

```powershell
.\.venv\Scripts\python.exe main.py --test-api-key
```

The test loads `.env` first, then `.env.example` as a fallback. Use `--api-test-model` to override the default smoke-test model.

## Test One Agent API Call

```powershell
.\.venv\Scripts\python.exe main.py --test-agent-api --test-agent-id recruiter
```

This sends built-in sample resume/JD text through one persona agent and prints the structured scorecard JSON. Use `--model` to override `OPENAI_MODEL` for agent, orchestrator, council, and synthesis calls.

## Run One Agent

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --agent recruiter
```

## Run The Orchestrator Plan

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --agent orchestrator
```

## Run All Agents

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --mode combat
```

Use `--mode bts` when you want direct analysis without debate-style lines.

## Run The Backend Server

Terminal 1:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn resume_roast_arena.server:app --reload --port 8001
```

The backend runs at `http://127.0.0.1:8001`.

Useful endpoints:

- `GET /health`
- `POST /roast`

## Run The Integrated Web Arena

Terminal 2:

```powershell
cd web
npm install
npm run dev
```

Create `.env` in the repo root, not inside `web`, and add a real key:

```text
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
```

The web app posts parsed resume text to Next's `/api/roast` route. That route proxies to the Python FastAPI backend at `http://127.0.0.1:8001` by default. Set `RESUME_ARENA_BACKEND_URL` in `web/.env.local` only if your backend runs somewhere else.

## Available Agents

- `orchestrator` (planning only)
- `recruiter`
- `ats`
- `startup_founder`
- `hiring_manager`
- `brutally_honest_friend`
- `morale_friend`

## Output

The CLI prints JSON with scorecards, red flags, add/remove/change suggestions, ATS notes, debate lines, and a final prioritized action plan. A future LaTeX/MCP integration can consume this JSON to produce the final resume file.

## Council Flow

The full arena now runs as a common LLM council:

1. `OrchestratorAgent` chooses the useful persona agents, debate setting, council focus, synthesis focus, and risk controls.
2. Selected personas independently review the resume.
3. Combat mode creates a civil debate when the orchestrator decides it is useful.
4. `LLMCouncil` adjudicates disagreements and produces one shared council decision.
5. The final synthesizer uses the orchestrator plan and council decision to create prioritized fixes and a plain-text improved resume draft.
