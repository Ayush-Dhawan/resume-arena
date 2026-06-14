from __future__ import annotations

from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate

from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.prompts import RESUME_WRITER_SYSTEM_PROMPT
from resume_roast_arena.schemas import ArenaResult, ResumeBlueprint, ResumeContext


WRITER_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", RESUME_WRITER_SYSTEM_PROMPT),
        (
            "human",
            """
Create a detailed resume blueprint for this candidate.

Context:
Target role: {target_role}
Target company: {target_company}
Experience level: {experience_level}
Preferred tone: {preferred_tone}
Mode: {mode}

Original resume:
{resume_text}

Job description:
{job_description}

Arena result:
{arena_result}

Reference LaTeX template:
{latex_template}
""",
        ),
    ]
)


def load_sample_template() -> str:
    return (
        Path(__file__).resolve().parent / "resources" / "sample_resume_template.tex"
    ).read_text(encoding="utf-8")


class ResumeWriterAgent:
    """Builds one factual, target-aware resume blueprint from arena output."""

    def __init__(self, config: OpenAIConfig | None = None) -> None:
        require_openai_key()
        self.config = config or OpenAIConfig()
        self.llm = build_chat_model(self.config)
        self.chain = WRITER_PROMPT | self.llm.with_structured_output(ResumeBlueprint)
        self.template_text = load_sample_template()

    def build_blueprint(
        self,
        context: ResumeContext,
        arena_result: ArenaResult,
    ) -> ResumeBlueprint:
        return self.chain.invoke(
            {
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "experience_level": context.experience_level or "Not specified",
                "preferred_tone": context.preferred_tone,
                "mode": context.mode,
                "resume_text": context.resume_text,
                "job_description": context.job_description or "Not provided",
                "arena_result": arena_result.model_dump(),
                "latex_template": self.template_text,
            }
        )
