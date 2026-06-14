# Resume Roast Arena

MVP agent layer for a roast-style resume improvement app.

This repo now contains the common LLM council flow plus a structured resume-writer path that can render a LaTeX resume from the included sample template.

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

## Generate A LaTeX Resume

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --mode combat --generate-latex --latex-output tailored_resume.tex
```

This runs the full arena, lets the council resolve agent disagreements, then asks the resume-writer agent to produce a structured blueprint and renders a new `.tex` file that follows `sample_resume_template.tex`.

## Postman Resume PDF Endpoint

After starting the Next.js app from `web/`, use:

```text
POST http://localhost:3000/api/resume/generate
```

Use `form-data` body fields:

- `resume`: file upload, PDF/DOCX/TEX/TXT/MD/RTF
- `targetRole`: optional text, for example `Backend Intern`
- `targetCompany`: optional text, for example `Acme`

The endpoint parses the uploaded file with `resume-parser.ts`, saves extracted text under `resume_roast_arena/resources`, writes a dummy agent JSON file beside it, generates an updated `.tex` from `sample_resume_template.tex`, and returns a downloadable PDF response. The dummy JSON is intentionally isolated so the real agent integration can replace it later.

## Available Agents

- `orchestrator` (planning only)
- `recruiter`
- `ats`
- `startup_founder`
- `hiring_manager`
- `brutally_honest_friend`
- `morale_friend`

## Output

The CLI prints JSON with scorecards, red flags, add/remove/change suggestions, ATS notes, debate lines, and a final prioritized action plan.

With `--generate-latex`, it also returns:

- a structured resume blueprint derived from all agent output
- the saved LaTeX output path
- the template name used for rendering

## Council Flow

The full arena now runs as a common LLM council:

1. `OrchestratorAgent` chooses the useful persona agents, debate setting, council focus, synthesis focus, and risk controls.
2. Selected personas independently review the resume.
3. Combat mode creates a civil debate when the orchestrator decides it is useful.
4. `LLMCouncil` adjudicates disagreements and produces one shared council decision.
5. The final synthesizer uses the orchestrator plan and council decision to create prioritized fixes and a plain-text improved resume draft.
6. `ResumeWriterAgent` converts the whole arena output into a detailed, factual resume blueprint.
7. `LatexResumeRenderer` deterministically renders that blueprint into the sample LaTeX template structure.
