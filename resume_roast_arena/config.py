from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class OpenAIConfig:
    model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))
    timeout: int = int(os.getenv("OPENAI_TIMEOUT", "60"))


def require_openai_key() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your environment or .env file."
        )
