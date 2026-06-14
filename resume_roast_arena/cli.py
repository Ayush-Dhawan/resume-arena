from __future__ import annotations

import argparse
import json
from pathlib import Path

from resume_roast_arena.agents import build_agent
from resume_roast_arena.api_test import DEFAULT_TEST_MODEL, format_api_key_test_result
from resume_roast_arena.arena import ResumeRoastArena
from resume_roast_arena.config import OpenAIConfig
from resume_roast_arena.orchestrator import OrchestratorAgent
from resume_roast_arena.prompts import AGENT_SPECS
from resume_roast_arena.schemas import ResumeContext
from resume_roast_arena.smoke import run_agent_api_smoke_test


def read_text(path: str | None, fallback: str = "") -> str:
    if not path:
        return fallback
    return Path(path).read_text(encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resume Roast Arena agent runner")
    parser.add_argument(
        "--test-api-key",
        action="store_true",
        help="Run a minimal OpenAI Responses API request and exit",
    )
    parser.add_argument(
        "--api-test-model",
        default=DEFAULT_TEST_MODEL,
        help="Model to use with --test-api-key",
    )
    parser.add_argument(
        "--test-agent-api",
        action="store_true",
        help="Run one real persona agent against built-in sample data and exit",
    )
    parser.add_argument(
        "--test-agent-id",
        choices=list(AGENT_SPECS.keys()),
        default="recruiter",
        help="Agent to use with --test-agent-api",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override OPENAI_MODEL for agent, orchestrator, council, and synthesis calls",
    )
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
        choices=["all", "orchestrator", *AGENT_SPECS.keys()],
        default="all",
        help="Run one persona, the orchestrator plan, or the full arena",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.test_api_key:
        print(format_api_key_test_result(model=args.api_test_model))
        return

    config = OpenAIConfig(model=args.model) if args.model else OpenAIConfig()

    if args.test_agent_api:
        scorecard = run_agent_api_smoke_test(args.test_agent_id, config=config)
        print(json.dumps(scorecard.model_dump(), indent=2))
        return

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
        if args.agent == "orchestrator":
            plan = OrchestratorAgent(config=config).plan(context)
            print(json.dumps(plan.model_dump(), indent=2))
            return

        if args.agent != "all":
            scorecard = build_agent(args.agent, config=config).review(context)
            print(json.dumps(scorecard.model_dump(), indent=2))
            return

        result = ResumeRoastArena(config=config).run(context)
        print(json.dumps(result.model_dump(), indent=2))
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc
