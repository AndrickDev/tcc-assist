from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.orchestrator.chat import ChatQuotaState, run_chat

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tcc_id: str
    message: str = Field(min_length=1, max_length=5000)


class ChatResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    content: str
    agent_id: str
    quota: ChatQuotaState

    @field_serializer("quota")
    def serialize_quota(self, quota: ChatQuotaState) -> dict[str, int | str]:
        return {
            "used": quota.used,
            "remaining": quota.remaining,
            "reset_at": _format_datetime(quota.reset_at),
        }


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("chat"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis_client: Annotated[Redis, Depends(get_redis_dep)],
) -> ChatResponse | JSONResponse:
    if claims.tcc_id != request.tcc_id:
        return JSONResponse(status_code=403, content={"error": "tcc_id_mismatch"})

    result = await run_chat(
        pool=pool,
        redis_client=redis_client,
        user_id=claims.sub,
        plan=claims.plan,
        tcc_id=request.tcc_id,
        message=request.message,
    )
    return ChatResponse(content=result.content, agent_id=result.agent_id, quota=result.quota)


def _format_datetime(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")
