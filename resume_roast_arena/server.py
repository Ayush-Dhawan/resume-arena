from __future__ import annotations

import logging
import os
import sys
from time import perf_counter
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from resume_roast_arena.arena import ResumeRoastArena
from resume_roast_arena.config import REPO_ROOT
from resume_roast_arena.schemas import ArenaResult, ResumeContext


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger(__name__)


class RoastRequest(BaseModel):
    resume_text: str = Field(alias="resumeText")
    job_description: str = Field(default="", alias="jobDescription")
    target_role: str = Field(default="", alias="targetRole")
    target_company: str = Field(default="", alias="targetCompany")
    experience_level: str = Field(default="", alias="experienceLevel")
    preferred_tone: str = Field(
        default="confident, direct, ATS-friendly",
        alias="preferredTone",
    )
    mode: Literal["bts", "combat"] = "combat"
    agent_ids: list[str] | None = Field(default=None, alias="agentIds")


app = FastAPI(title="Resume Roast Arena API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def log_startup() -> None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    logger.info(
        "Backend startup. repo_root=%s cwd=%s env_file_exists=%s api_key_present=%s api_key_length=%s api_key_is_placeholder=%s",
        REPO_ROOT,
        os.getcwd(),
        (REPO_ROOT / ".env").exists(),
        bool(api_key),
        len(api_key),
        api_key == "sk-your-key-here",
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4())[:8])
    started_at = perf_counter()
    logger.info(
        "HTTP request started. request_id=%s method=%s path=%s client=%s",
        request_id,
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
    )
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "HTTP request failed with unhandled exception. request_id=%s method=%s path=%s elapsed_ms=%s",
            request_id,
            request.method,
            request.url.path,
            round((perf_counter() - started_at) * 1000),
        )
        raise

    logger.info(
        "HTTP request completed. request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        round((perf_counter() - started_at) * 1000),
    )
    response.headers["x-request-id"] = request_id
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/roast", response_model=ArenaResult)
def roast_resume(request: RoastRequest) -> ArenaResult:
    request_id = str(uuid4())[:8]
    started_at = perf_counter()
    logger.info(
        "Roast request received. request_id=%s target_role=%s target_company=%s mode=%s agents=%s resume_chars=%s jd_chars=%s",
        request_id,
        request.target_role or "Not specified",
        request.target_company or "Not specified",
        request.mode,
        request.agent_ids or "orchestrator-selected",
        len(request.resume_text),
        len(request.job_description),
    )

    if not request.resume_text.strip():
        logger.warning("Roast request rejected: empty resume. request_id=%s", request_id)
        raise HTTPException(
            status_code=400,
            detail="Upload and parse a resume before starting a roast.",
        )

    context = ResumeContext(
        resume_text=request.resume_text,
        job_description=request.job_description,
        target_role=request.target_role,
        target_company=request.target_company,
        experience_level=request.experience_level,
        preferred_tone=request.preferred_tone,
        mode=request.mode,
    )

    try:
        result = ResumeRoastArena().run(context, agent_ids=request.agent_ids)
        logger.info(
            "Roast request completed. request_id=%s scorecards=%s debate_turns=%s elapsed_ms=%s",
            request_id,
            len(result.scorecards),
            len(result.debate),
            round((perf_counter() - started_at) * 1000),
        )
        return result
    except RuntimeError as exc:
        logger.exception("Roast request failed with runtime error. request_id=%s", request_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        logger.exception("Roast request failed with value error. request_id=%s", request_id)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Roast request failed unexpectedly. request_id=%s", request_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
