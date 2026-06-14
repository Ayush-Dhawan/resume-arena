from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from resume_roast_arena.config import OpenAIConfig, build_chat_model, require_openai_key
from resume_roast_arena.prompts import AGENT_SPECS, AgentSpec
from resume_roast_arena.schemas import AgentScorecard, ResumeContext


REVIEW_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", "{system_prompt}"),
        (
            "human",
            """
Review this resume for Resume Roast Arena.

Target role: {target_role}
Target company: {target_company}
Experience level: {experience_level}
Preferred tone: {preferred_tone}
Mode: {mode}

Job description:
{job_description}

Resume:
{resume_text}
""",
        ),
    ]
)


class ResumeAgent:
    def __init__(self, spec: AgentSpec, config: OpenAIConfig | None = None) -> None:
        require_openai_key()
        self.spec = spec
        self.config = config or OpenAIConfig()
        self.llm = build_chat_model(self.config)
        self.chain = REVIEW_PROMPT | self.llm.with_structured_output(AgentScorecard)

    def review(self, context: ResumeContext) -> AgentScorecard:
        result = self.chain.invoke(
            {
                "system_prompt": self.spec.system_prompt,
                "target_role": context.target_role or "Not specified",
                "target_company": context.target_company or "Not specified",
                "experience_level": context.experience_level or "Not specified",
                "preferred_tone": context.preferred_tone,
                "mode": context.mode,
                "job_description": context.job_description or "Not provided",
                "resume_text": context.resume_text,
            }
        )
        result.agent_id = self.spec.agent_id
        result.agent_name = self.spec.name
        return result


def build_agent(agent_id: str, config: OpenAIConfig | None = None) -> ResumeAgent:
    try:
        spec = AGENT_SPECS[agent_id]
    except KeyError as exc:
        available = ", ".join(AGENT_SPECS)
        raise ValueError(f"Unknown agent '{agent_id}'. Available agents: {available}") from exc
    return ResumeAgent(spec=spec, config=config)


def build_all_agents(config: OpenAIConfig | None = None) -> list[ResumeAgent]:
    return [ResumeAgent(spec, config=config) for spec in AGENT_SPECS.values()]
