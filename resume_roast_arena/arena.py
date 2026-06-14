from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import perf_counter

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from resume_roast_arena.agents import build_all_agents
from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.council import LLMCouncil
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
        if len(agents) == 1:
            scorecards = [agents[0].review(context)]
        else:
            scorecards_by_id: dict[str, AgentScorecard] = {}
            with ThreadPoolExecutor(max_workers=min(len(agents), 6)) as executor:
                futures = {
                    executor.submit(agent.review, context): agent.spec.agent_id
                    for agent in agents
                }
                for future in as_completed(futures):
                    agent_id = futures[future]
                    scorecards_by_id[agent_id] = future.result()
            scorecards = [scorecards_by_id[agent.spec.agent_id] for agent in agents]
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

    def assemble_from_agent_reviews(
        self,
        context: ResumeContext,
        scorecards: list[AgentScorecard],
        orchestration_plan: OrchestrationPlan,
    ) -> ArenaResult:
        """Build a low-latency arena result from completed agent reviews."""
        started_at = perf_counter()
        logger.info(
            "Assembling arena result from agent reviews. scorecards=%s mode=%s",
            len(scorecards),
            context.mode,
        )
        debate = self._build_debate_from_scorecards(context, scorecards)
        council_decision = self._build_council_from_scorecards(scorecards)
        prioritized_feedback = self._collect_feedback(
            scorecards,
            "change_suggestions",
            "add_suggestions",
            "formatting_improvements",
        )
        red_flags = self._collect_feedback(scorecards, "red_flags")
        result = ArenaResult(
            mode=context.mode,
            orchestration_plan=orchestration_plan,
            scorecards=scorecards,
            debate=debate,
            council_decision=council_decision,
            prioritized_feedback=prioritized_feedback[:8],
            red_flags=red_flags[:6],
            final_resume_draft=self._build_draft_note(context, prioritized_feedback),
            ats_friendly_version_notes=self._build_ats_notes(scorecards),
            reasons_behind_changes=[
                "This fast arena response is assembled from the live agent scorecards.",
                "The extra council and final synthesis LLM passes are skipped for UI latency.",
                "Recommendations are grounded in the uploaded resume text and selected target role.",
            ],
        )
        logger.info(
            "Arena result assembled from reviews. debate_turns=%s feedback=%s elapsed_ms=%s",
            len(result.debate),
            len(result.prioritized_feedback),
            round((perf_counter() - started_at) * 1000),
        )
        return result

    def _build_debate_from_scorecards(
        self, context: ResumeContext, scorecards: list[AgentScorecard]
    ) -> list[DebateTurn]:
        if context.mode != "combat" or len(scorecards) < 2:
            return []

        turns: list[DebateTurn] = []
        for index, scorecard in enumerate(scorecards):
            challenged = min(
                scorecards,
                key=lambda other: (
                    other.overall_score,
                    other.agent_id == scorecard.agent_id,
                ),
            )
            action_item = self._first_action_item(scorecard)
            turns.append(
                DebateTurn(
                    speaker_agent_id=scorecard.agent_id,
                    message=f"{scorecard.roast_line} {scorecard.verdict}",
                    agrees_with=[
                        previous.agent_id
                        for previous in scorecards[:index]
                        if previous.overall_score >= scorecard.overall_score
                    ][:2],
                    challenges=(
                        [challenged.agent_id]
                        if challenged.agent_id != scorecard.agent_id
                        else []
                    ),
                    action_item=action_item,
                )
            )
        return turns

    def _build_council_from_scorecards(
        self, scorecards: list[AgentScorecard]
    ) -> CouncilDecision:
        if not scorecards:
            raise ValueError("Cannot build a council decision without scorecards.")

        average_score = round(
            sum(scorecard.overall_score for scorecard in scorecards) / len(scorecards)
        )
        if average_score >= 78:
            verdict = "strong_resume"
        elif average_score >= 60:
            verdict = "promising_needs_polish"
        elif average_score >= 45:
            verdict = "not_targeted_enough"
        else:
            verdict = "needs_major_revision"

        weakest = sorted(scorecards, key=lambda scorecard: scorecard.overall_score)[:2]
        strongest = max(scorecards, key=lambda scorecard: scorecard.overall_score)
        return CouncilDecision(
            council_verdict=verdict,
            shortlist_readiness_score=average_score,
            consensus_summary=(
                f"{len(scorecards)} agents reviewed the resume. Average readiness is "
                f"{average_score}%, with {strongest.agent_name or strongest.agent_id} "
                "seeing the strongest signal."
            ),
            main_disagreements=[
                f"{scorecard.agent_name or scorecard.agent_id} scored it {scorecard.overall_score}%."
                for scorecard in weakest
            ],
            council_votes=[
                CouncilVote(
                    agent_id=scorecard.agent_id,
                    stance=self._score_to_stance(scorecard.overall_score),
                    must_fix_before_shortlist=[
                        item.title for item in scorecard.red_flags[:2]
                    ],
                    top_strength_to_preserve=(
                        scorecard.strengths[0].title if scorecard.strengths else ""
                    ),
                )
                for scorecard in scorecards
            ],
            must_fix_now=self._collect_feedback(scorecards, "red_flags")[:4],
            should_fix_next=self._collect_feedback(scorecards, "change_suggestions")[:4],
            nice_to_have=self._collect_feedback(
                scorecards,
                "add_suggestions",
                "formatting_improvements",
            )[:4],
            rewrite_strategy=[
                "Prioritize the highest-risk gaps called out by the lowest-scoring agents.",
                "Preserve strong proof points while making role fit and impact more explicit.",
                "Keep the rewrite ATS-friendly and avoid invented metrics or experience.",
            ],
            agent_priority_order=[
                scorecard.agent_id
                for scorecard in sorted(
                    scorecards,
                    key=lambda item: item.overall_score,
                )
            ],
            final_council_note=(
                "Fast council summary generated from live agent scorecards for a responsive UI."
            ),
        )

    @staticmethod
    def _collect_feedback(
        scorecards: list[AgentScorecard], *field_names: str
    ) -> list[FeedbackItem]:
        items: list[FeedbackItem] = []
        priority_order = {"high": 0, "medium": 1, "low": 2}
        seen: set[str] = set()
        for scorecard in scorecards:
            for field_name in field_names:
                for item in getattr(scorecard, field_name):
                    key = f"{item.title}|{item.recommendation}"
                    if key in seen:
                        continue
                    seen.add(key)
                    items.append(item)
        return sorted(items, key=lambda item: priority_order[item.priority])

    @staticmethod
    def _first_action_item(scorecard: AgentScorecard) -> str:
        for group in (
            scorecard.red_flags,
            scorecard.change_suggestions,
            scorecard.add_suggestions,
            scorecard.formatting_improvements,
        ):
            if group:
                return group[0].recommendation
        return "Keep the strongest evidence and make the target-role fit explicit."

    @staticmethod
    def _score_to_stance(score: int) -> str:
        if score >= 80:
            return "strong_accept"
        if score >= 65:
            return "accept"
        if score >= 45:
            return "mixed"
        return "reject"

    @staticmethod
    def _build_ats_notes(scorecards: list[AgentScorecard]) -> list[str]:
        keywords: list[str] = []
        for scorecard in scorecards:
            keywords.extend(scorecard.ats_keywords_to_add)
        unique_keywords = list(dict.fromkeys(keyword for keyword in keywords if keyword))
        if unique_keywords:
            return [f"Consider adding verified keywords: {', '.join(unique_keywords[:12])}."]
        return ["Use clear section headings, plain bullets, and role-specific keywords."]

    @staticmethod
    def _build_draft_note(
        context: ResumeContext, prioritized_feedback: list[FeedbackItem]
    ) -> str:
        target = context.target_role or "the target role"
        actions = "\n".join(
            f"- {item.recommendation}" for item in prioritized_feedback[:5]
        )
        return (
            f"Fast draft guidance for {target}:\n"
            f"{actions or '- Preserve the original facts and sharpen impact bullets.'}\n\n"
            "Original resume text is preserved for now; a full rewritten resume draft can "
            "run as a separate slower export step."
        )

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
            orchestration_plan = OrchestrationPlan(
                selected_agent_ids=agent_ids,
                run_debate=context.mode == "combat" and len(agent_ids) > 1,
                council_focus=[
                    "Resolve the highest-priority resume risks from the requested agents."
                ],
                synthesis_focus=[
                    "Convert agent feedback into practical, ATS-friendly resume improvements."
                ],
                risk_controls=[
                    "Do not invent experience, metrics, employers, dates, or education."
                ],
                reasoning=(
                    "Requested agent IDs were supplied by the caller, so the "
                    "orchestrator LLM pass was skipped to reduce latency."
                ),
            )
            logger.info(
                "Orchestrator skipped because caller supplied agent_ids. selected_agents=%s run_debate=%s",
                orchestration_plan.selected_agent_ids,
                orchestration_plan.run_debate,
            )
        else:
            orchestration_plan = self.orchestrator.plan(context)
        scorecards = self.review_with_agents(
            context, agent_ids=orchestration_plan.selected_agent_ids
        )
        if agent_ids:
            result = self.assemble_from_agent_reviews(
                context,
                scorecards,
                orchestration_plan,
            )
            logger.info(
                "Arena run completed through fast requested-agent path. elapsed_ms=%s",
                round((perf_counter() - started_at) * 1000),
            )
            return result

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
