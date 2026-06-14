# Resume Roast Arena

MVP for a roast-style resume improvement app.

This repo contains:

- `resume_roast_arena/`: reusable LangChain + OpenAI agents.
- `web/`: Next.js UI with resume upload and parsing for PDF, DOCX, LaTeX, TXT, Markdown, and RTF.

## Setup

### Agent Backend

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
```

Add your key to `.env`:

```text
OPENAI_API_KEY=sk-your-key-here
```

### Web App

```powershell
cd web
npm install
npm run dev
```

The web app runs at `http://localhost:3000` by default.

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

The CLI prints JSON with scorecards, red flags, add/remove/change suggestions, ATS notes, debate lines, and a final prioritized action plan. The web app currently prepares parsed resume text and metadata for the future agent backend integration.
