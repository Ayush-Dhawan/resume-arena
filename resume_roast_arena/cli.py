from __future__ import annotations

import argparse
import json
from pathlib import Path

from resume_roast_arena.agents import build_agent
from resume_roast_arena.arena import ResumeRoastArena
from resume_roast_arena.prompts import AGENT_SPECS
from resume_roast_arena.schemas import ResumeContext


def read_text(path: str | None, fallback: str = "") -> str:
    if not path:
        return fallback
    return Path(path).read_text(encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resume Roast Arena agent runner")
    parser.add_argument("--resume-file", help="Path to a plain-text resume")
    parser.add_argument("--resume-text", help="Raw resume text")
    parser.add_argument("--job-file", help="Path to a plain-text job description")
    parser.add_argument("--job-description", default="", help="Raw job description")
    parser.add_argument("--role", default="", help="Target role")
    parser.add_argument("--company", default="", help="Target company")
    parser.add_argument("--experience-level", default="", help="Experience level")
    parser.add_argument(
        "--preferred-tone", default="confident, direct, ATS-friendly"
    )
    parser.add_argument("--mode", choices=["bts", "combat"], default="combat")
    parser.add_argument(
        "--agent",
        choices=["all", *AGENT_SPECS.keys()],
        default="all",
        help="Run one persona or the full arena",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    resume_text = read_text(args.resume_file, args.resume_text or "")
    if not resume_text.strip():
        raise SystemExit("Provide --resume-file or --resume-text.")

    context = ResumeContext(
        resume_text=resume_text,
        job_description=read_text(args.job_file, args.job_description),
        target_role=args.role,
        target_company=args.company,
        experience_level=args.experience_level,
        preferred_tone=args.preferred_tone,
        mode=args.mode,
    )

    try:
        if args.agent != "all":
            scorecard = build_agent(args.agent).review(context)
            print(json.dumps(scorecard.model_dump(), indent=2))
            return

        result = ResumeRoastArena().run(context)
        print(json.dumps(result.model_dump(), indent=2))
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc
