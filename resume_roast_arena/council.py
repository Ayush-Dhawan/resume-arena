from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.prompts import COUNCIL_SYSTEM_PROMPT
from resume_roast_arena.schemas import (
    AgentScorecard,
    CouncilDecision,
    DebateTurn,
    OrchestrationPlan,
    ResumeContext,
)


COUNCIL_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", COUNCIL_SYSTEM_PROMPT),
        (
            "human",
            """
Run the Resume Roast Arena council.

Context:
Target role: {target_role}
Target company: {target_company}
Experience level: {experience_level}
Preferred tone: {preferred_tone}
Mode: {mode}

Job description:
{job_description}

Resume:
{resume_text}

Agent scorecards:
{scorecards}

Debate turns:
{debate}

Orchestration plan:
{orchestration_plan}
""",
        ),
    ]
)


class LLMCouncil:
    """Common adjudication layer that turns agent opinions into one decision."""

    def __init__(self, config: OpenAIConfig | None = None) -> None:
        require_openai_key()
        self.config = config or OpenAIConfig()
        self.llm = build_chat_model(self.config)
        self.chain = COUNCIL_PROMPT | self.llm.with_structured_output(CouncilDecision)

    def deliberate(
        self,
        context: ResumeContext,
        scorecards: list[AgentScorecard],
        debate: list[DebateTurn] | None = None,
        orchestration_plan: OrchestrationPlan | None = None,
    ) -> CouncilDecision:
        result = self.chain.invoke(
            {
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "experience_level": context.experience_level or "Not specified",
                "preferred_tone": context.preferred_tone,
                "mode": context.mode,
                "job_description": context.job_description or "Not provided",
                "resume_text": context.resume_text,
                "scorecards": [scorecard.model_dump() for scorecard in scorecards],
                "debate": [turn.model_dump() for turn in debate or []],
                "orchestration_plan": (
                    orchestration_plan.model_dump() if orchestration_plan else {}
                ),
            }
        )
        return result
