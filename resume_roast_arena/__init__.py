"""Agent layer for Resume Roast Arena."""

from __future__ import annotations

from importlib import import_module
from typing import Any


__all__ = [
    "LLMCouncil",
    "LatexResumeRenderer",
    "OrchestratorAgent",
    "ResumeAgent",
    "ResumeRoastArena",
    "ResumeWriterAgent",
    "build_agent",
    "build_all_agents",
]


_EXPORTS = {
    "LLMCouncil": ("resume_roast_arena.council", "LLMCouncil"),
    "LatexResumeRenderer": (
        "resume_roast_arena.latex_renderer",
        "LatexResumeRenderer",
    ),
    "OrchestratorAgent": (
        "resume_roast_arena.orchestrator",
        "OrchestratorAgent",
    ),
    "ResumeAgent": ("resume_roast_arena.agents", "ResumeAgent"),
    "ResumeRoastArena": ("resume_roast_arena.arena", "ResumeRoastArena"),
    "ResumeWriterAgent": ("resume_roast_arena.writer", "ResumeWriterAgent"),
    "build_agent": ("resume_roast_arena.agents", "build_agent"),
    "build_all_agents": ("resume_roast_arena.agents", "build_all_agents"),
}


def __getattr__(name: str) -> Any:
    try:
        module_name, attribute_name = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module 'resume_roast_arena' has no attribute {name!r}") from exc

    module = import_module(module_name)
    value = getattr(module, attribute_name)
    globals()[name] = value
    return value
