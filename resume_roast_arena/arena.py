from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from resume_roast_arena.agents import build_all_agents
from resume_roast_arena.config import OpenAIConfig, require_openai_key
from resume_roast_arena.prompts import DEBATE_SYSTEM_PROMPT, SYNTHESIS_SYSTEM_PROMPT
from resume_roast_arena.schemas import (
    AgentScorecard,
    ArenaResult,
    DebateTurn,
    ResumeContext,
)


DEBATE_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", DEBATE_SYSTEM_PROMPT),
        (
            "human",
            """
Create 5 to 8 debate turns from these scorecards.

Context:
Target role: {target_role}
Target company: {target_company}
Mode: {mode}

Scorecards:
{scorecards}
""",
        ),
    ]
)


SYNTHESIS_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", SYNTHESIS_SYSTEM_PROMPT),
        (
            "human",
            """
Create the final ArenaResult from this material.

Mode: {mode}
Target role: {target_role}
Target company: {target_company}
Experience level: {experience_level}
Preferred tone: {preferred_tone}

Original resume:
{resume_text}

Job description:
{job_description}

Scorecards:
{scorecards}

Debate:
{debate}
""",
        ),
    ]
)


class DebateTurns(BaseModel):
    turns: list[DebateTurn]


class ResumeRoastArena:
    def __init__(self, config: OpenAIConfig | None = None) -> None:
        require_openai_key()
        self.config = config or OpenAIConfig()
        self.llm = ChatOpenAI(
            model=self.config.model,
            temperature=self.config.temperature,
            timeout=self.config.timeout,
        )
        self.debate_chain = DEBATE_PROMPT | self.llm.with_structured_output(DebateTurns)
        self.synthesis_chain = SYNTHESIS_PROMPT | self.llm.with_structured_output(
            ArenaResult
        )

    def review_with_agents(
        self, context: ResumeContext, agent_ids: list[str] | None = None
    ) -> list[AgentScorecard]:
        agents = build_all_agents(self.config)
        if agent_ids:
            requested = set(agent_ids)
            agents = [agent for agent in agents if agent.spec.agent_id in requested]
        return [agent.review(context) for agent in agents]

    def debate(
        self, context: ResumeContext, scorecards: list[AgentScorecard]
    ) -> list[DebateTurn]:
        if context.mode == "bts":
            return []
        result = self.debate_chain.invoke(
            {
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "mode": context.mode,
                "scorecards": [scorecard.model_dump() for scorecard in scorecards],
            }
        )
        return result.turns

    def synthesize(
        self,
        context: ResumeContext,
        scorecards: list[AgentScorecard],
        debate: list[DebateTurn] | None = None,
    ) -> ArenaResult:
        debate = debate or []
        result = self.synthesis_chain.invoke(
            {
                "mode": context.mode,
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "experience_level": context.experience_level or "Not specified",
                "preferred_tone": context.preferred_tone,
                "resume_text": context.resume_text,
                "job_description": context.job_description or "Not provided",
                "scorecards": [scorecard.model_dump() for scorecard in scorecards],
                "debate": [turn.model_dump() for turn in debate],
            }
        )
        result.mode = context.mode
        result.scorecards = scorecards
        result.debate = debate
        return result

    def run(
        self, context: ResumeContext, agent_ids: list[str] | None = None
    ) -> ArenaResult:
        scorecards = self.review_with_agents(context, agent_ids=agent_ids)
        debate = self.debate(context, scorecards)
        return self.synthesize(context, scorecards, debate)
