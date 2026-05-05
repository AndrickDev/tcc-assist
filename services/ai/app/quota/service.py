from datetime import UTC, datetime, timedelta
from time import perf_counter

import redis
import structlog
from redis.asyncio import Redis

from app.quota.config import KEY_TTL_SECONDS, PLAN_LIMITS, SCOPE_WEIGHTS
from app.quota.exceptions import QuotaBackendUnavailable, QuotaInvalidPlan
from app.quota.models import ConsumeResult, PlanName, QuotaState, Scope

log = structlog.get_logger(__name__)


def _today_key(user_id: str) -> str:
    return f"quota:{user_id}:{datetime.now(UTC).strftime('%Y-%m-%d')}"


def _next_reset() -> datetime:
    now = datetime.now(UTC)
    tomorrow = now.date() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=UTC)


def _resolve_limit(plan: PlanName) -> int:
    try:
        return PLAN_LIMITS[plan]
    except KeyError as exc:
        raise QuotaInvalidPlan(f"Plano de quota invalido: {plan}") from exc


async def consume(
    *,
    redis_client: Redis,
    user_id: str,
    scope: Scope,
    plan: PlanName,
) -> ConsumeResult:
    """Increment daily quota usage. VIP is unlimited but still counted for observability."""

    started = perf_counter()
    weight = SCOPE_WEIGHTS[scope]
    limit = _resolve_limit(plan)
    reset_at = _next_reset()
    key = _today_key(user_id)

    try:
        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.incrby(key, weight)
            pipe.expire(key, KEY_TTL_SECONDS)
            result = await pipe.execute()
    except redis.RedisError as exc:
        raise QuotaBackendUnavailable("Redis indisponivel para quota") from exc

    used = int(result[0])
    if limit == -1:
        allowed = True
        remaining = -1
        reason = None
    else:
        allowed = used <= limit
        remaining = max(0, limit - used)
        reason = None if allowed else "limit_exceeded"

    latency_ms = round((perf_counter() - started) * 1000, 3)
    log.info(
        "quota_consumed",
        user_id=user_id,
        scope=scope,
        plan=plan,
        weight=weight,
        used=used,
        allowed=allowed,
        remaining=remaining,
        latency_ms=latency_ms,
    )
    return ConsumeResult(
        used=used,
        allowed=allowed,
        remaining=remaining,
        reset_at=reset_at,
        reason=reason,
    )


async def get_state(
    *,
    redis_client: Redis,
    user_id: str,
    plan: PlanName,
) -> QuotaState:
    """Read current daily quota usage without incrementing it."""

    started = perf_counter()
    limit = _resolve_limit(plan)
    key = _today_key(user_id)

    try:
        raw_used = await redis_client.get(key)
    except redis.RedisError as exc:
        raise QuotaBackendUnavailable("Redis indisponivel para quota") from exc

    used = int(raw_used) if raw_used is not None else 0
    remaining = -1 if limit == -1 else max(0, limit - used)
    latency_ms = round((perf_counter() - started) * 1000, 3)
    log.info(
        "quota_state_read",
        user_id=user_id,
        plan=plan,
        used=used,
        remaining=remaining,
        latency_ms=latency_ms,
    )
    return QuotaState(
        used=used,
        limit=limit,
        remaining=remaining,
        reset_at=_next_reset(),
    )
