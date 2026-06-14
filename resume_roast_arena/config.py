from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI


REPO_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(REPO_ROOT / ".env.example")
load_dotenv(REPO_ROOT / ".env", override=True)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OpenAIConfig:
    model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))
    timeout: int = int(os.getenv("OPENAI_TIMEOUT", "60"))


def require_openai_key() -> None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key == "sk-your-key-here":
        logger.error(
            "OpenAI key missing or placeholder. repo_root=%s env_file_exists=%s key_present=%s key_length=%s",
            REPO_ROOT,
            (REPO_ROOT / ".env").exists(),
            bool(api_key),
            len(api_key),
        )
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your environment or .env file."
        )


def build_chat_model(config: OpenAIConfig | None = None) -> ChatOpenAI:
    require_openai_key()
    config = config or OpenAIConfig()
    logger.info(
        "Building OpenAI chat model. model=%s temperature=%s timeout=%s",
        config.model,
        config.temperature,
        config.timeout,
    )
    return ChatOpenAI(
        model=config.model,
        temperature=config.temperature,
        timeout=config.timeout,
    )
