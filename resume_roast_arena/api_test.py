from __future__ import annotations

import os

from openai import OpenAI, OpenAIError


DEFAULT_TEST_MODEL = "gpt-5.5"
DEFAULT_TEST_PROMPT = "Write a one-sentence bedtime story about a unicorn."


def test_openai_api_key(
    model: str | None = None,
    prompt: str = DEFAULT_TEST_PROMPT,
) -> str:
    """Run a minimal Responses API request to verify the configured key works."""
    client = OpenAI()
    response = client.responses.create(
        model=model or os.getenv("OPENAI_TEST_MODEL", DEFAULT_TEST_MODEL),
        input=prompt,
    )
    return response.output_text


def format_api_key_test_result(model: str | None = None) -> str:
    try:
        output_text = test_openai_api_key(model=model)
    except OpenAIError as exc:
        return f"OpenAI API test failed: {exc}"
    return f"OpenAI API test passed:\n{output_text}"
