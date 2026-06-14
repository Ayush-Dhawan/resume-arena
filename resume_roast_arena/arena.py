from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    CouncilVote,
    DebateTurn,
    FeedbackItem,
    OrchestrationPlan,
    ResumeBlueprint,
    ResumeBuildResult,
    ResumeContext,
)
from resume_roast_arena.writer import ResumeWriterAgent


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
        self.llm = None
        self.debate_chain = None
        self.synthesis_chain = None
        self.orchestrator = None
        self.council = None
        self.resume_writer = None
        self.latex_renderer = LatexResumeRenderer()

    def _get_llm(self):
        if self.llm is None:
            self.llm = build_chat_model(self.config)
        return self.llm

    def _get_debate_chain(self):
        if self.debate_chain is None:
            self.debate_chain = DEBATE_PROMPT | self._get_llm().with_structured_output(
                DebateTurns
            )
        return self.debate_chain

    def _get_synthesis_chain(self):
        if self.synthesis_chain is None:
            self.synthesis_chain = (
                SYNTHESIS_PROMPT
                | self._get_llm().with_structured_output(ArenaResult)
            )
        return self.synthesis_chain

    def _get_orchestrator(self) -> OrchestratorAgent:
        if self.orchestrator is None:
            self.orchestrator = OrchestratorAgent(self.config)
        return self.orchestrator

    def _get_council(self) -> LLMCouncil:
        if self.council is None:
            self.council = LLMCouncil(self.config)
        return self.council

    def _get_resume_writer(self) -> ResumeWriterAgent:
        if self.resume_writer is None:
            self.resume_writer = ResumeWriterAgent(self.config)
        return self.resume_writer

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
        scorecards_by_agent_id: dict[str, AgentScorecard] = {}
        with ThreadPoolExecutor(max_workers=min(len(agents), 6) or 1) as executor:
            futures = {
                executor.submit(agent.review, context): agent.spec.agent_id
                for agent in agents
            }
            for future in as_completed(futures):
                agent_id = futures[future]
                scorecards_by_agent_id[agent_id] = future.result()

        scorecards = [
            scorecards_by_agent_id[agent.spec.agent_id]
            for agent in agents
            if agent.spec.agent_id in scorecards_by_agent_id
        ]
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
        result = self._get_debate_chain().invoke(
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
        result = self._get_synthesis_chain().invoke(
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
        if agent_ids:
            result = self.run_agent_only(context, agent_ids)
            logger.info(
                "Arena direct agent-only run completed. elapsed_ms=%s",
                round((perf_counter() - started_at) * 1000),
            )
            return result

        orchestration_plan = self._get_orchestrator().plan(
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
        council_decision = self._get_council().deliberate(
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

    def run_agent_only(
        self, context: ResumeContext, agent_ids: list[str]
    ) -> ArenaResult:
        """Run each selected persona once and merge their scorecards without extra LLM calls."""
        orchestration_plan = OrchestrationPlan(
            selected_agent_ids=agent_ids,
            run_debate=False,
            council_focus=[
                "Direct UI roast path: each requested persona reviewed the full resume once.",
            ],
            synthesis_focus=[
                "Use persona scorecards directly; ask the user for missing metrics before rewriting claims.",
            ],
            risk_controls=[
                "Do not infer metrics, dates, scope, users, latency, revenue, or impact not present in agent evidence.",
            ],
            reasoning=(
                "The UI requested explicit agents, so the backend skipped orchestrator, "
                "debate, council, and synthesizer LLM calls."
            ),
        )
        scorecards = self.review_with_agents(context, agent_ids=agent_ids)
        red_flags = self._collect_feedback(scorecards, "red_flags", limit=10)
        prioritized_feedback = self._prioritized_feedback(scorecards, limit=12)
        council_decision = self._deterministic_council_decision(scorecards)
        debate = self._synthetic_debate_turns(scorecards)
        return ArenaResult(
            mode=context.mode,
            orchestration_plan=orchestration_plan,
            scorecards=scorecards,
            debate=debate,
            council_decision=council_decision,
            prioritized_feedback=prioritized_feedback,
            red_flags=red_flags,
            final_resume_draft=self._draft_from_agent_bullets(scorecards),
            ats_friendly_version_notes=self._ats_notes(scorecards),
            reasons_behind_changes=[
                "Built from one full-resume review call per selected persona agent.",
                "No extra LLM synthesis was used in this UI path.",
                "Copilot edit agent should ask the user for missing proof before applying quantified claims.",
            ],
        )

    @staticmethod
    def _collect_feedback(
        scorecards: list[AgentScorecard], field_name: str, limit: int
    ) -> list[FeedbackItem]:
        items: list[FeedbackItem] = []
        seen: set[str] = set()
        for scorecard in scorecards:
            for item in getattr(scorecard, field_name):
                key = item.title.lower()
                if key in seen:
                    continue
                seen.add(key)
                items.append(item)
                if len(items) >= limit:
                    return items
        return items

    @classmethod
    def _prioritized_feedback(
        cls, scorecards: list[AgentScorecard], limit: int
    ) -> list[FeedbackItem]:
        fields = [
            "red_flags",
            "change_suggestions",
            "add_suggestions",
            "formatting_improvements",
            "remove_suggestions",
        ]
        priority_rank = {"high": 0, "medium": 1, "low": 2}
        items: list[FeedbackItem] = []
        seen: set[str] = set()
        for field in fields:
            for item in cls._collect_feedback(scorecards, field, limit=100):
                key = item.title.lower()
                if key not in seen:
                    seen.add(key)
                    items.append(item)
        return sorted(items, key=lambda item: priority_rank[item.priority])[:limit]

    @staticmethod
    def _deterministic_council_decision(
        scorecards: list[AgentScorecard],
    ) -> CouncilDecision:
        if not scorecards:
            score = 0
        else:
            score = round(
                sum(scorecard.overall_score for scorecard in scorecards)
                / len(scorecards)
            )
        if score >= 80:
            verdict = "strong_resume"
        elif score >= 60:
            verdict = "promising_needs_polish"
        elif score >= 40:
            verdict = "not_targeted_enough"
        else:
            verdict = "needs_major_revision"
        votes = [
            CouncilVote(
                agent_id=scorecard.agent_id,
                stance=(
                    "accept"
                    if scorecard.overall_score >= 70
                    else "mixed"
                    if scorecard.overall_score >= 45
                    else "reject"
                ),
                must_fix_before_shortlist=[
                    item.title for item in scorecard.red_flags[:3]
                ],
                top_strength_to_preserve=(
                    scorecard.strengths[0].title if scorecard.strengths else ""
                ),
            )
            for scorecard in scorecards
        ]
        return CouncilDecision(
            council_verdict=verdict,
            shortlist_readiness_score=score,
            consensus_summary=(
                "Direct persona review complete. Scores and edit queue are built "
                "from one full-resume LLM call per selected agent."
            ),
            main_disagreements=[],
            council_votes=votes,
            must_fix_now=[],
            should_fix_next=[],
            nice_to_have=[],
            rewrite_strategy=[
                "Use the agent scorecards as source feedback.",
                "Ask the user for exact numbers before rewriting quantified claims.",
                "Keep ATS, recruiter, and hiring-manager suggestions visible in the edit queue.",
            ],
            agent_priority_order=[scorecard.agent_id for scorecard in scorecards],
            final_council_note=(
                "This is a deterministic merge of persona outputs, not an extra council LLM call."
            ),
        )

    @staticmethod
    def _synthetic_debate_turns(scorecards: list[AgentScorecard]) -> list[DebateTurn]:
        return [
            DebateTurn(
                speaker_agent_id=scorecard.agent_id,
                message=scorecard.roast_line or scorecard.verdict,
                agrees_with=[],
                challenges=[],
                action_item=(
                    scorecard.change_suggestions[0].recommendation
                    if scorecard.change_suggestions
                    else scorecard.verdict
                ),
            )
            for scorecard in scorecards
        ]

    @staticmethod
    def _draft_from_agent_bullets(scorecards: list[AgentScorecard]) -> str:
        bullets = [
            bullet
            for scorecard in scorecards
            for bullet in scorecard.bullet_rewrites
        ]
        if not bullets:
            return (
                "Resume draft pending. Use the Copilot edit queue to gather missing "
                "metrics and apply verified agent recommendations."
            )
        return "\n".join(f"- {bullet}" for bullet in bullets[:12])

    @staticmethod
    def _ats_notes(scorecards: list[AgentScorecard]) -> list[str]:
        keywords = []
        for scorecard in scorecards:
            keywords.extend(scorecard.ats_keywords_to_add)
        unique_keywords = []
        seen = set()
        for keyword in keywords:
            key = keyword.lower()
            if key not in seen:
                seen.add(key)
                unique_keywords.append(keyword)
        return (
            [f"Consider adding verified keywords: {', '.join(unique_keywords[:12])}"]
            if unique_keywords
            else ["No additional ATS keywords were returned by the selected agents."]
        )
