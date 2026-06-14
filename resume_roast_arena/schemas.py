from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Mode = Literal["bts", "combat"]


class ResumeContext(BaseModel):
    resume_text: str = Field(..., description="Raw resume text supplied by the user.")
    job_description: str = Field(
        default="", description="Target job description, if supplied."
    )
    target_role: str = Field(default="", description="Target role title.")
    target_company: str = Field(default="", description="Target company.")
    experience_level: str = Field(default="", description="Junior, mid, senior, etc.")
    preferred_tone: str = Field(
        default="confident, direct, ATS-friendly",
        description="Preferred style for rewrite suggestions.",
    )
    mode: Mode = "combat"


class FeedbackItem(BaseModel):
    title: str
    evidence: str = Field(description="Specific resume/JD evidence behind the point.")
    recommendation: str
    priority: Literal["high", "medium", "low"] = "medium"


class AgentScorecard(BaseModel):
    agent_id: str = ""
    agent_name: str = ""
    overall_score: int = Field(ge=0, le=100)
    role_fit_score: int = Field(ge=0, le=100)
    clarity_score: int = Field(ge=0, le=100)
    ats_score: int = Field(ge=0, le=100)
    impact_score: int = Field(ge=0, le=100)
    verdict: str
    roast_line: str = Field(
        description="A witty but civil one-liner. No insults about identity."
    )
    strengths: list[FeedbackItem] = Field(default_factory=list)
    red_flags: list[FeedbackItem] = Field(default_factory=list)
    add_suggestions: list[FeedbackItem] = Field(default_factory=list)
    remove_suggestions: list[FeedbackItem] = Field(default_factory=list)
    change_suggestions: list[FeedbackItem] = Field(default_factory=list)
    formatting_improvements: list[FeedbackItem] = Field(default_factory=list)
    ats_keywords_to_add: list[str] = Field(default_factory=list)
    bullet_rewrites: list[str] = Field(default_factory=list)
    reasoning: str


class DebateTurn(BaseModel):
    speaker_agent_id: str
    message: str
    agrees_with: list[str] = Field(default_factory=list)
    challenges: list[str] = Field(default_factory=list)
    action_item: str


class CouncilVote(BaseModel):
    agent_id: str
    stance: Literal["strong_accept", "accept", "mixed", "reject"]
    must_fix_before_shortlist: list[str] = Field(default_factory=list)
    top_strength_to_preserve: str = ""


class OrchestrationPlan(BaseModel):
    selected_agent_ids: list[str] = Field(
        default_factory=list,
        description="Persona agent IDs the orchestrator wants to run for this review.",
    )
    run_debate: bool = Field(
        default=True,
        description="Whether a debate pass is useful before council adjudication.",
    )
    council_focus: list[str] = Field(
        default_factory=list,
        description="Issues the council should explicitly adjudicate.",
    )
    synthesis_focus: list[str] = Field(
        default_factory=list,
        description="Issues the final synthesizer should emphasize in the rewrite.",
    )
    risk_controls: list[str] = Field(
        default_factory=list,
        description="Guardrails to prevent fabricated or over-optimized resume changes.",
    )
    reasoning: str = Field(
        description="Concise explanation for the orchestration choices."
    )


class CouncilDecision(BaseModel):
    council_verdict: Literal[
        "strong_resume",
        "promising_needs_polish",
        "needs_major_revision",
        "not_targeted_enough",
    ]
    shortlist_readiness_score: int = Field(ge=0, le=100)
    consensus_summary: str
    main_disagreements: list[str] = Field(default_factory=list)
    council_votes: list[CouncilVote] = Field(default_factory=list)
    must_fix_now: list[FeedbackItem] = Field(default_factory=list)
    should_fix_next: list[FeedbackItem] = Field(default_factory=list)
    nice_to_have: list[FeedbackItem] = Field(default_factory=list)
    rewrite_strategy: list[str] = Field(default_factory=list)
    agent_priority_order: list[str] = Field(
        default_factory=list,
        description="Agent IDs ordered by whose feedback matters most for this target role.",
    )
    final_council_note: str


class ArenaResult(BaseModel):
    mode: Mode = "combat"
    orchestration_plan: OrchestrationPlan | None = None
    scorecards: list[AgentScorecard] = Field(default_factory=list)
    debate: list[DebateTurn] = Field(default_factory=list)
    council_decision: CouncilDecision | None = None
    prioritized_feedback: list[FeedbackItem] = Field(default_factory=list)
    red_flags: list[FeedbackItem] = Field(default_factory=list)
    final_resume_draft: str = Field(
        description="Plain-text improved resume draft before optional LaTeX rendering."
    )
    ats_friendly_version_notes: list[str] = Field(default_factory=list)
    reasons_behind_changes: list[str] = Field(default_factory=list)


class ResumeHeader(BaseModel):
    full_name: str
    phone: str = ""
    email: str = ""
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""


class EducationEntry(BaseModel):
    institution: str
    location: str = ""
    credential: str
    score_line: str = ""
    start_date: str = ""
    end_date: str = ""


class SkillCategory(BaseModel):
    label: str
    items: list[str] = Field(default_factory=list)


class ExperienceEntry(BaseModel):
    company: str
    date_range: str = ""
    title: str
    location: str = ""
    bullets: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    name: str
    tech_stack: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class LeadershipEntry(BaseModel):
    label: str
    description: str


class CertificationEntry(BaseModel):
    name: str
    issuer: str = ""


class ResumeInsight(BaseModel):
    category: Literal[
        "positioning",
        "skills",
        "experience",
        "projects",
        "education",
        "leadership",
        "certifications",
        "formatting",
    ]
    insight: str
    evidence: str
    applied_change: str
    priority: Literal["high", "medium", "low"] = "medium"


class ResumeBlueprint(BaseModel):
    target_role: str = ""
    target_company: str = ""
    summary_strategy: str = Field(
        description=(
            "How the rewritten resume positions the candidate for the target role "
            "within the constraints of the LaTeX template."
        )
    )
    insights: list[ResumeInsight] = Field(default_factory=list)
    header: ResumeHeader
    education: list[EducationEntry] = Field(default_factory=list)
    skill_categories: list[SkillCategory] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    leadership: list[LeadershipEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)
    omissions_to_verify: list[str] = Field(
        default_factory=list,
        description=(
            "Missing or ambiguous facts the user should verify before exporting the final resume."
        ),
    )


class ResumeBuildResult(BaseModel):
    arena_result: ArenaResult
    resume_blueprint: ResumeBlueprint
    latex_source: str
    template_name: str = "sample_resume_template.tex"
