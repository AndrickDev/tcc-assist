from collections.abc import AsyncIterator

import fakeredis.aioredis
import pytest

from app.rag.embedding_cache import cache_key, get_many, set_many


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def test_cache_round_trip_set_get(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    await set_many(fake_redis, "model-a", [("texto", [1.0, 2.0])])

    result = await get_many(fake_redis, "model-a", ["texto"])

    assert result == [[1.0, 2.0]]


async def test_cache_get_many_miss_e_hit(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    await set_many(fake_redis, "model-a", [("hit", [3.0])])

    result = await get_many(fake_redis, "model-a", ["miss", "hit"])

    assert result == [None, [3.0]]


async def test_cache_corrompido_retorna_none(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    await fake_redis.set(cache_key("model-a", "texto"), "nao-json")

    result = await get_many(fake_redis, "model-a", ["texto"])

    assert result == [None]
