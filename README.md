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

## Run One Agent

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --agent recruiter
```

## Run All Agents

```powershell
.\.venv\Scripts\python.exe main.py --resume-file resume.txt --job-file jd.txt --role "Backend Intern" --company "Acme" --mode combat
```

Use `--mode bts` when you want direct analysis without debate-style lines.

## Available Agents

- `recruiter`
- `ats`
- `startup_founder`
- `hiring_manager`
- `brutally_honest_friend`
- `morale_friend`

## Output

The CLI prints JSON with scorecards, red flags, add/remove/change suggestions, ATS notes, debate lines, and a final prioritized action plan. A future LaTeX/MCP integration can consume this JSON to produce the final resume file.
