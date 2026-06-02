from collections.abc import AsyncIterator, Sequence

import fakeredis.aioredis
import pytest

from app.providers.embedding import EmbedResult
from app.rag.embedder import embed_texts
from app.rag.embedding_cache import get_many, set_many


class StubEmbeddingProvider:
    model = "stub-model"
    dim = 3

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    async def embed(self, texts: Sequence[str]) -> EmbedResult:
        batch = list(texts)
        self.calls.append(batch)
        return EmbedResult(
            model=self.model,
            dim=self.dim,
            vectors=[[float(len(text)), 1.0, 2.0] for text in batch],
        )


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def test_embedder_all_hits_nao_chama_provider(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    provider = StubEmbeddingProvider()
    await set_many(
        fake_redis,
        provider.model,
        [("a", [1.0, 0.0, 0.0]), ("b", [2.0, 0.0, 0.0])],
    )

    result = await embed_texts(provider=provider, redis=fake_redis, texts=["a", "b"])

    assert result == [[1.0, 0.0, 0.0], [2.0, 0.0, 0.0]]
    assert provider.calls == []


async def test_embedder_all_misses_chama_provider_e_popula_cache(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    provider = StubEmbeddingProvider()

    result = await embed_texts(provider=provider, redis=fake_redis, texts=["aa", "bbb"])
    cached = await get_many(fake_redis, provider.model, ["aa", "bbb"])

    assert result == [[2.0, 1.0, 2.0], [3.0, 1.0, 2.0]]
    assert cached == result
    assert provider.calls == [["aa", "bbb"]]


async def test_embedder_mixed_hits_misses_preserva_ordem(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    provider = StubEmbeddingProvider()
    await set_many(fake_redis, provider.model, [("hit", [9.0, 9.0, 9.0])])

    result = await embed_texts(
        provider=provider,
        redis=fake_redis,
        texts=["miss-a", "hit", "miss-b"],
    )

    assert result == [[6.0, 1.0, 2.0], [9.0, 9.0, 9.0], [6.0, 1.0, 2.0]]
    assert provider.calls == [["miss-a", "miss-b"]]


async def test_embedder_input_vazio_nao_chama_provider(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    provider = StubEmbeddingProvider()

    result = await embed_texts(provider=provider, redis=fake_redis, texts=[])

    assert result == []
    assert provider.calls == []
