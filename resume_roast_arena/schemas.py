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


class ArenaResult(BaseModel):
    mode: Mode = "combat"
    scorecards: list[AgentScorecard] = Field(default_factory=list)
    debate: list[DebateTurn] = Field(default_factory=list)
    prioritized_feedback: list[FeedbackItem] = Field(default_factory=list)
    red_flags: list[FeedbackItem] = Field(default_factory=list)
    final_resume_draft: str = Field(
        description="Plain-text improved resume draft. LaTeX generation is future scope."
    )
    ats_friendly_version_notes: list[str] = Field(default_factory=list)
    reasons_behind_changes: list[str] = Field(default_factory=list)
