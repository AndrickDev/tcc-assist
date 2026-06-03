from collections.abc import AsyncIterator, Sequence
from typing import cast

import asyncpg
import fakeredis.aioredis
import pytest
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider, EmbedResult
from app.rag import embedder, repository
from app.rag.chat_retrieval import retrieve_for_chat


class FakeProvider:
    model = "test-model"
    dim = 3

    async def embed(self, texts: Sequence[str]) -> EmbedResult:
        return EmbedResult(model=self.model, dim=self.dim, vectors=[[1.0, 0.0, 0.0]])


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


def _pool() -> asyncpg.Pool:
    return cast(asyncpg.Pool, object())


def _provider() -> EmbeddingProvider:
    return cast(EmbeddingProvider, FakeProvider())


def _row(chunk_id: str, content: str, score: float) -> dict[str, object]:
    return {
        "chunk_id": chunk_id,
        "source_type": "pdf",
        "source_ref": "att-1",
        "ordinal": 1,
        "content": content,
        "metadata": {},
        "score": score,
    }


async def test_retrieve_for_chat_happy_path(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        assert texts == ["busca"]
        return [[1.0, 0.0, 0.0]]

    async def search_similar_chunks(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        query_vector: Sequence[float],
        top_k: int,
        source_types: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        assert tcc_id == "tcc-1"
        assert query_vector == [1.0, 0.0, 0.0]
        assert top_k == 5
        assert source_types is None
        return [
            _row("chunk-1", "um", 0.9),
            _row("chunk-2", "dois", 0.6),
            _row("chunk-3", "tres", 0.3),
        ]

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="busca",
    )

    assert [chunk.chunk_id for chunk in chunks] == ["chunk-1", "chunk-2"]


async def test_retrieve_for_chat_budget_corta_excedente(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        return [[1.0, 0.0, 0.0]]

    async def search_similar_chunks(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        query_vector: Sequence[float],
        top_k: int,
        source_types: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        return [_row("chunk-1", "a" * 10, 0.9), _row("chunk-2", "b" * 10, 0.8)]

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="busca",
        max_chars=15,
    )

    assert [chunk.chunk_id for chunk in chunks] == ["chunk-1"]


async def test_retrieve_for_chat_query_vazia_retorna_vazio(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="   ",
    )

    assert chunks == []


async def test_retrieve_for_chat_embed_falha_loga_warning_e_retorna_vazio(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        raise RuntimeError("embed boom")

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)

    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="busca",
    )

    assert chunks == []


async def test_retrieve_for_chat_search_falha_loga_warning_e_retorna_vazio(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        return [[1.0, 0.0, 0.0]]

    async def search_similar_chunks(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        query_vector: Sequence[float],
        top_k: int,
        source_types: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        raise RuntimeError("search boom")

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="busca",
    )

    assert chunks == []


async def test_retrieve_for_chat_sem_resultados_retorna_vazio(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        return [[1.0, 0.0, 0.0]]

    async def search_similar_chunks(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        query_vector: Sequence[float],
        top_k: int,
        source_types: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        return []

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    chunks = await retrieve_for_chat(
        pool=_pool(),
        redis=cast(Redis, fake_redis),
        provider=_provider(),
        tcc_id="tcc-1",
        query="busca",
    )

    assert chunks == []
