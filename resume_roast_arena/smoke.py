from __future__ import annotations

from resume_roast_arena.agents import build_agent
from resume_roast_arena.config import OpenAIConfig
from resume_roast_arena.schemas import AgentScorecard, ResumeContext


SAMPLE_RESUME = """
Alex Patel
alex@example.com | github.com/alexpatel | linkedin.com/in/alexpatel

SUMMARY
Computer science student interested in backend engineering and APIs.

PROJECTS
Task Tracker API
- Built a REST API for tasks using Python and Flask.
- Added login and database storage.
- Wrote tests for important endpoints.

Campus Events Website
- Created pages for browsing and posting student events.
- Worked with two classmates and presented the project in class.

SKILLS
Python, Flask, SQL, Git, REST APIs, HTML, CSS
"""


SAMPLE_JOB_DESCRIPTION = """
Backend intern role working on REST APIs, SQL-backed services, automated tests,
debugging production issues, and collaborating with product engineers.
"""


def build_smoke_context() -> ResumeContext:
    return ResumeContext(
        resume_text=SAMPLE_RESUME.strip(),
        job_description=SAMPLE_JOB_DESCRIPTION.strip(),
        target_role="Backend Intern",
        target_company="Acme",
        experience_level="student / intern",
        mode="bts",
    )


def run_agent_api_smoke_test(
    agent_id: str = "recruiter",
    config: OpenAIConfig | None = None,
) -> AgentScorecard:
    return build_agent(agent_id, config=config).review(build_smoke_context())
