import asyncio
from datetime import datetime
from time import perf_counter
from typing import Literal

import asyncpg
import structlog
from pydantic import BaseModel, ConfigDict
from redis.asyncio import Redis

from app.db.models import TccMetadata
from app.db.tcc_repo import get_tcc_metadata, list_recent_messages, list_selected_references
from app.orchestrator.conversation import build_conversation_block, messages_limit_for_plan
from app.orchestrator.exceptions import QuotaExceeded, TccNotFoundOrForbidden
from app.orchestrator.references import build_references_block
from app.prompts.chat import Plan, TccMetadataInput, build_chat_prompt
from app.providers.gemini import generate, get_config_for_plan
from app.providers.postprocess import strip_code_fences
from app.quota.service import consume

AgentId = Literal["redator-free", "redator-pro", "redator-vip"]

log = structlog.get_logger(__name__)


class ChatQuotaState(BaseModel):
    model_config = ConfigDict(frozen=True)

    used: int
    remaining: int
    reset_at: datetime


class ChatResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    content: str
    agent_id: AgentId
    quota: ChatQuotaState


async def run_chat(
    *,
    pool: asyncpg.Pool,
    redis_client: Redis,
    user_id: str,
    plan: Plan,
    tcc_id: str,
    message: str,
) -> ChatResult:
    started = perf_counter()
    log.info("chat_started", user_id=user_id, plan=plan, tcc_id=tcc_id)
    try:
        tcc_metadata = await get_tcc_metadata(pool=pool, tcc_id=tcc_id, user_id=user_id)
        if tcc_metadata is None:
            raise TccNotFoundOrForbidden("tcc_not_found")

        quota_result = await consume(
            redis_client=redis_client,
            user_id=user_id,
            scope="chat",
            plan=plan,
        )
        log.info(
            "chat_quota_consumed",
            user_id=user_id,
            plan=plan,
            tcc_id=tcc_id,
            allowed=quota_result.allowed,
            remaining=quota_result.remaining,
        )
        if not quota_result.allowed:
            raise QuotaExceeded(remaining=quota_result.remaining, reset_at=quota_result.reset_at)

        message_limit = messages_limit_for_plan(plan)
        refs_task = list_selected_references(pool=pool, tcc_id=tcc_id)
        if message_limit > 0:
            messages_task = list_recent_messages(pool=pool, tcc_id=tcc_id, limit=message_limit)
            refs, recent_messages = await asyncio.gather(refs_task, messages_task)
        else:
            refs = await refs_task
            recent_messages = []

        prompt = build_chat_prompt(
            plan=plan,
            tcc_metadata=_to_prompt_metadata(tcc_metadata),
            references_block=build_references_block(refs),
            conversation_block=build_conversation_block(plan, recent_messages),
            user_message=message,
        )
        raw_content = await generate(prompt=prompt, config=get_config_for_plan(plan))
        content = strip_code_fences(raw_content)
        log.info("chat_generated", user_id=user_id, plan=plan, tcc_id=tcc_id)

        result = ChatResult(
            content=content,
            agent_id=_agent_id_for_plan(plan),
            quota=ChatQuotaState(
                used=quota_result.used,
                remaining=quota_result.remaining,
                reset_at=quota_result.reset_at,
            ),
        )
        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info("chat_completed", user_id=user_id, plan=plan, tcc_id=tcc_id, latency_ms=latency_ms)
        return result
    except Exception:
        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info("chat_failed", user_id=user_id, plan=plan, tcc_id=tcc_id, latency_ms=latency_ms)
        raise


def _to_prompt_metadata(metadata: TccMetadata) -> TccMetadataInput:
    return TccMetadataInput(
        title=metadata.title,
        course=metadata.course,
        institution=metadata.institution,
        work_type=metadata.work_type,
        norma=metadata.norma,
        objective=metadata.objective,
    )


def _agent_id_for_plan(plan: Plan) -> AgentId:
    if plan == "VIP":
        return "redator-vip"
    if plan == "PRO":
        return "redator-pro"
    return "redator-free"
