from __future__ import annotations

import logging
from time import perf_counter

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from resume_roast_arena.agents import build_all_agents
from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.council import LLMCouncil
from resume_roast_arena.latex_renderer import LatexResumeRenderer
from resume_roast_arena.orchestrator import OrchestratorAgent
from resume_roast_arena.prompts import DEBATE_SYSTEM_PROMPT, SYNTHESIS_SYSTEM_PROMPT
from resume_roast_arena.schemas import (
    AgentScorecard,
    ArenaResult,
    CouncilDecision,
    DebateTurn,
    OrchestrationPlan,
    ResumeBlueprint,
    ResumeBuildResult,
    ResumeContext,
)


logger = logging.getLogger(__name__)


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

Council decision:
{council_decision}

Orchestration plan:
{orchestration_plan}
""",
        ),
    ]
)


class DebateTurns(BaseModel):
    turns: list[DebateTurn]


class ResumeRoastArena:
    def __init__(self, config: OpenAIConfig | None = None) -> None:
        logger.info("Initializing ResumeRoastArena.")
        require_openai_key()
        self.config = config or OpenAIConfig()
        self.llm = build_chat_model(self.config)
        self.debate_chain = DEBATE_PROMPT | self.llm.with_structured_output(DebateTurns)
        self.synthesis_chain = SYNTHESIS_PROMPT | self.llm.with_structured_output(
            ArenaResult
        )
        self.orchestrator = OrchestratorAgent(self.config)
        self.council = LLMCouncil(self.config)
        self.resume_writer = ResumeWriterAgent(self.config)
        self.latex_renderer = LatexResumeRenderer()

    def review_with_agents(
        self, context: ResumeContext, agent_ids: list[str] | None = None
    ) -> list[AgentScorecard]:
        started_at = perf_counter()
        agents = build_all_agents(self.config)
        if agent_ids:
            agents_by_id = {agent.spec.agent_id: agent for agent in agents}
            missing = [agent_id for agent_id in agent_ids if agent_id not in agents_by_id]
            if missing:
                available = ", ".join(agents_by_id)
                raise ValueError(
                    f"Unknown agent(s): {', '.join(missing)}. "
                    f"Available agents: {available}"
                )
            agents = [agents_by_id[agent_id] for agent_id in agent_ids]
        logger.info(
            "Running persona reviews. agents=%s",
            [agent.spec.agent_id for agent in agents],
        )
        scorecards = [agent.review(context) for agent in agents]
        logger.info(
            "Persona reviews completed. count=%s elapsed_ms=%s",
            len(scorecards),
            round((perf_counter() - started_at) * 1000),
        )
        return scorecards

    def debate(
        self, context: ResumeContext, scorecards: list[AgentScorecard]
    ) -> list[DebateTurn]:
        if context.mode == "bts":
            logger.info("Debate skipped because mode=bts.")
            return []
        started_at = perf_counter()
        logger.info("Debate generation started. scorecards=%s", len(scorecards))
        result = self.debate_chain.invoke(
            {
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "mode": context.mode,
                "scorecards": [scorecard.model_dump() for scorecard in scorecards],
            }
        )
        logger.info(
            "Debate generation completed. turns=%s elapsed_ms=%s",
            len(result.turns),
            round((perf_counter() - started_at) * 1000),
        )
        return result.turns

    def synthesize(
        self,
        context: ResumeContext,
        scorecards: list[AgentScorecard],
        debate: list[DebateTurn] | None = None,
        council_decision: CouncilDecision | None = None,
        orchestration_plan: OrchestrationPlan | None = None,
    ) -> ArenaResult:
        started_at = perf_counter()
        debate = debate or []
        logger.info(
            "Final synthesis started. scorecards=%s debate_turns=%s council_present=%s",
            len(scorecards),
            len(debate),
            council_decision is not None,
        )
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
                "council_decision": (
                    council_decision.model_dump() if council_decision else {}
                ),
                "orchestration_plan": (
                    orchestration_plan.model_dump() if orchestration_plan else {}
                ),
            }
        )
        result.mode = context.mode
        result.orchestration_plan = orchestration_plan
        result.scorecards = scorecards
        result.debate = debate
        result.council_decision = council_decision
        logger.info(
            "Final synthesis completed. prioritized_feedback=%s red_flags=%s elapsed_ms=%s",
            len(result.prioritized_feedback),
            len(result.red_flags),
            round((perf_counter() - started_at) * 1000),
        )
        return result

    def run(
        self, context: ResumeContext, agent_ids: list[str] | None = None
    ) -> ArenaResult:
        started_at = perf_counter()
        logger.info(
            "Arena run started. requested_agents=%s target_role=%s target_company=%s mode=%s resume_chars=%s jd_chars=%s",
            agent_ids or "all",
            context.target_role or "Not specified",
            context.target_company or "Not specified",
            context.mode,
            len(context.resume_text),
            len(context.job_description),
        )
        orchestration_plan = self.orchestrator.plan(
            context, requested_agent_ids=agent_ids
        )
        scorecards = self.review_with_agents(
            context, agent_ids=orchestration_plan.selected_agent_ids
        )
        debate = (
            self.debate(context, scorecards)
            if orchestration_plan.run_debate
            else []
        )
        council_decision = self.council.deliberate(
            context,
            scorecards,
            debate,
            orchestration_plan=orchestration_plan,
        )
        result = self.synthesize(
            context,
            scorecards,
            debate,
            council_decision,
            orchestration_plan=orchestration_plan,
        )
        logger.info(
            "Arena run completed. elapsed_ms=%s",
            round((perf_counter() - started_at) * 1000),
        )
        return result
