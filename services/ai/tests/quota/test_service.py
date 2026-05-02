from collections.abc import AsyncIterator
from typing import cast

import fakeredis.aioredis
import pytest
import redis
from redis.asyncio import Redis

from app.quota.exceptions import QuotaBackendUnavailable, QuotaInvalidPlan
from app.quota.models import PlanName
from app.quota.service import consume, get_state


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def test_consume_free_primeira_chamada_allowed(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    result = await consume(redis_client=fake_redis, user_id="user-1", scope="chat", plan="FREE")

    assert result.allowed is True
    assert result.remaining == 2
    assert result.reason is None


async def test_consume_free_excede_limite_no_quarto_chat(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    for _ in range(3):
        await consume(redis_client=fake_redis, user_id="user-1", scope="chat", plan="FREE")

    result = await consume(redis_client=fake_redis, user_id="user-1", scope="chat", plan="FREE")

    assert result.allowed is False
    assert result.remaining == 0
    assert result.reason == "limit_exceeded"


async def test_consume_vip_sempre_allowed_mesmo_apos_100_chamadas(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    for _ in range(100):
        result = await consume(
            redis_client=fake_redis,
            user_id="vip-1",
            scope="generate",
            plan="VIP",
        )
        assert result.allowed is True
        assert result.remaining == -1

    state = await get_state(redis_client=fake_redis, user_id="vip-1", plan="VIP")
    assert state.used == 300


async def test_consume_generate_pesa_3_no_pro(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    result = await consume(redis_client=fake_redis, user_id="pro-1", scope="generate", plan="PRO")

    assert result.allowed is True
    assert result.remaining == 47


async def test_consume_plano_desconhecido_levanta_invalid(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    with pytest.raises(QuotaInvalidPlan):
        await consume(
            redis_client=fake_redis,
            user_id="user-1",
            scope="chat",
            plan=cast(PlanName, "GOLD"),
        )


async def test_get_state_sem_uso_retorna_zero(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    state = await get_state(redis_client=fake_redis, user_id="user-1", plan="FREE")

    assert state.used == 0
    assert state.limit == 3
    assert state.remaining == 3


async def test_get_state_apos_consume_reflete_uso(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    await consume(redis_client=fake_redis, user_id="pro-1", scope="chat", plan="PRO")

    state = await get_state(redis_client=fake_redis, user_id="pro-1", plan="PRO")

    assert state.used == 1
    assert state.remaining == 49


class FailingPipeline:
    async def __aenter__(self) -> "FailingPipeline":
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def incrby(self, key: str, amount: int) -> None:
        return None

    def expire(self, key: str, ttl: int) -> None:
        return None

    async def execute(self) -> list[int]:
        raise redis.RedisError("boom")


class FailingRedis:
    def pipeline(self, transaction: bool = True) -> FailingPipeline:
        return FailingPipeline()


async def test_consume_redis_falha_levanta_backend_unavailable() -> None:
    failing_redis = cast(Redis, FailingRedis())

    with pytest.raises(QuotaBackendUnavailable):
        await consume(redis_client=failing_redis, user_id="user-1", scope="chat", plan="FREE")
