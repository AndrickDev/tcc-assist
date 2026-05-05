from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, field_serializer
from redis.asyncio import Redis

from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.quota.redis_client import get_redis
from app.quota.service import get_state

router = APIRouter(tags=["quota"])


class QuotaMeResponse(BaseModel):
    """Current quota state. For VIP, limit=-1 and remaining=-1 mean unlimited."""

    model_config = ConfigDict(frozen=True)

    used: int
    limit: int
    remaining: int
    reset_at: datetime

    @field_serializer("reset_at")
    def serialize_reset_at(self, reset_at: datetime) -> str:
        return reset_at.isoformat().replace("+00:00", "Z")


def get_redis_dep() -> Redis:
    return get_redis()


@router.get("/quota/me", response_model=QuotaMeResponse)
async def quota_me(
    claims: Annotated[InternalClaims, Depends(require_scope("quota"))],
    redis_client: Annotated[Redis, Depends(get_redis_dep)],
) -> QuotaMeResponse:
    state = await get_state(redis_client=redis_client, user_id=claims.sub, plan=claims.plan)
    return QuotaMeResponse(
        used=state.used,
        limit=state.limit,
        remaining=state.remaining,
        reset_at=state.reset_at,
    )
