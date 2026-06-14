from __future__ import annotations

import logging
from time import perf_counter

from langchain_core.prompts import ChatPromptTemplate

from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.prompts import AGENT_SPECS, ORCHESTRATOR_SYSTEM_PROMPT
from resume_roast_arena.schemas import OrchestrationPlan, ResumeContext


logger = logging.getLogger(__name__)


ORCHESTRATOR_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", ORCHESTRATOR_SYSTEM_PROMPT),
        (
            "human",
            """
Create an orchestration plan for this resume review.

Target role: {target_role}
Target company: {target_company}
Experience level: {experience_level}
Preferred tone: {preferred_tone}
Mode: {mode}
Requested agents: {requested_agents}

Available agents:
{available_agents}

Job description:
{job_description}

Resume:
{resume_text}
""",
        ),
    ]
)


class OrchestratorAgent:
    """Plans which persona agents and council focus areas to use."""

    def __init__(self, config: OpenAIConfig | None = None) -> None:
        require_openai_key()
        self.config = config or OpenAIConfig()
        self.llm = build_chat_model(self.config)
        self.chain = ORCHESTRATOR_PROMPT | self.llm.with_structured_output(
            OrchestrationPlan
        )

    def plan(
        self, context: ResumeContext, requested_agent_ids: list[str] | None = None
    ) -> OrchestrationPlan:
        started_at = perf_counter()
        requested_agent_ids = requested_agent_ids or []
        logger.info(
            "Orchestrator planning started. requested_agents=%s target_role=%s resume_chars=%s jd_chars=%s mode=%s",
            requested_agent_ids or "all",
            context.target_role or "Not specified",
            len(context.resume_text),
            len(context.job_description),
            context.mode,
        )
        plan = self.chain.invoke(
            {
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "experience_level": context.experience_level or "Not specified",
                "preferred_tone": context.preferred_tone,
                "mode": context.mode,
                "requested_agents": requested_agent_ids or "all",
                "available_agents": self._available_agents_text(),
                "job_description": context.job_description or "Not provided",
                "resume_text": context.resume_text,
            }
        )
        normalized = self._normalize_plan(plan, requested_agent_ids)
        logger.info(
            "Orchestrator planning completed. selected_agents=%s run_debate=%s elapsed_ms=%s",
            normalized.selected_agent_ids,
            normalized.run_debate,
            round((perf_counter() - started_at) * 1000),
        )
        return normalized

    @staticmethod
    def _available_agents_text() -> str:
        return "\n".join(
            f"- {spec.agent_id}: {spec.name} ({spec.role})"
            for spec in AGENT_SPECS.values()
        )

    @staticmethod
    def _normalize_plan(
        plan: OrchestrationPlan, requested_agent_ids: list[str]
    ) -> OrchestrationPlan:
        valid_agent_ids = set(AGENT_SPECS)
        allowed_agent_ids = (
            [agent_id for agent_id in requested_agent_ids if agent_id in valid_agent_ids]
            if requested_agent_ids
            else list(AGENT_SPECS)
        )
        allowed = set(allowed_agent_ids)
        selected = [
            agent_id
            for agent_id in plan.selected_agent_ids
            if agent_id in valid_agent_ids and agent_id in allowed
        ]

        if not selected:
            selected = allowed_agent_ids

        plan.selected_agent_ids = selected
        if requested_agent_ids:
            plan.reasoning = (
                f"{plan.reasoning} Requested agent constraints were respected."
            )
        return plan
