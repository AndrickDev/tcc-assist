from collections.abc import AsyncIterator, Sequence
from datetime import UTC, datetime, timedelta
from typing import cast

import asyncpg
import fakeredis.aioredis
import jwt
import pytest
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.db.deps import get_pool_dep
from app.main import create_app
from app.providers.embedding import EmbeddingProvider, EmbedResult, get_embedding_provider
from app.rag import embedder, embedding_cache, repository

SECRET = "test-secret-with-at-least-32-bytes"


class FakeProvider:
    model = "test-model"
    dim = 768

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    async def embed(self, texts: Sequence[str]) -> EmbedResult:
        batch = list(texts)
        self.calls.append(batch)
        return EmbedResult(model=self.model, dim=self.dim, vectors=[[1.0, 0.0, 0.0]])


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _make_token(*, scope: str = "retrieve", tcc_id: str | None = "tcc-1") -> str:
    claims: dict[str, object] = {
        "sub": "user-1",
        "plan": "PRO",
        "scope": scope,
        "iat": _timestamp(timedelta(minutes=-1)),
        "exp": _timestamp(timedelta(minutes=5)),
        "iss": "tcc-assist-web",
        "aud": "tcc-assist-ai",
    }
    if tcc_id is not None:
        claims["tccId"] = tcc_id
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _client(redis_client: Redis | None = None, provider: FakeProvider | None = None) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: cast(asyncpg.Pool, object())
    app.dependency_overrides[get_redis_dep] = lambda: redis_client or cast(Redis, object())
    app.dependency_overrides[get_embedding_provider] = lambda: cast(
        EmbeddingProvider, provider or FakeProvider()
    )
    return TestClient(app)


def _auth_header(token: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token or _make_token()}"}


def test_retrieve_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    provider = FakeProvider()

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
        assert top_k == 3
        assert source_types is None
        return [
            {
                "chunk_id": "chunk-1",
                "source_type": "pdf",
                "source_ref": "att-1",
                "ordinal": 0,
                "content": "um",
                "metadata": {"page": 1},
                "score": 0.99,
            },
            {
                "chunk_id": "chunk-2",
                "source_type": "openalex",
                "source_ref": "ref-1",
                "ordinal": 1,
                "content": "dois",
                "metadata": {},
                "score": 0.91,
            },
            {
                "chunk_id": "chunk-3",
                "source_type": "pdf",
                "source_ref": "att-1",
                "ordinal": 2,
                "content": "tres",
                "metadata": {},
                "score": 0.80,
            },
        ]

    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    response = _client(provider=provider).post(
        "/v1/retrieve",
        json={"query": "busca", "top_k": 3},
        headers=_auth_header(),
    )
    data = response.json()

    assert response.status_code == 200
    assert data["model"] == provider.model
    assert len(data["chunks"]) == 3
    assert [chunk["chunk_id"] for chunk in data["chunks"]] == [
        "chunk-1",
        "chunk-2",
        "chunk-3",
    ]


def test_retrieve_query_vazia_retorna_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/retrieve",
        json={"query": ""},
        headers=_auth_header(),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("top_k", [0, 99])
def test_retrieve_top_k_invalido_422(
    monkeypatch: pytest.MonkeyPatch,
    top_k: int,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/retrieve",
        json={"query": "busca", "top_k": top_k},
        headers=_auth_header(),
    )

    assert response.status_code == 422


def test_retrieve_source_types_invalido_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/retrieve",
        json={"query": "busca", "source_types": ["pdf", "weird"]},
        headers=_auth_header(),
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "invalid_source_types:weird"


def test_retrieve_scope_errado_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/retrieve",
        json={"query": "busca"},
        headers=_auth_header(_make_token(scope="chat")),
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_retrieve_tcc_sem_chunks_retorna_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    provider = FakeProvider()

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

    response = _client(provider=provider).post(
        "/v1/retrieve",
        json={"query": "busca"},
        headers=_auth_header(),
    )

    assert response.status_code == 200
    assert response.json() == {"query": "busca", "model": provider.model, "chunks": []}


async def test_retrieve_cache_hit_embedder_nao_chama_provider(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    provider = FakeProvider()
    await embedding_cache.set_many(
        fake_redis,
        provider.model,
        [("busca", [1.0, 0.0, 0.0])],
    )

    async def search_similar_chunks(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        query_vector: Sequence[float],
        top_k: int,
        source_types: Sequence[str] | None = None,
    ) -> list[dict[str, object]]:
        assert query_vector == [1.0, 0.0, 0.0]
        return []

    monkeypatch.setattr(repository, "search_similar_chunks", search_similar_chunks)

    response = _client(redis_client=cast(Redis, fake_redis), provider=provider).post(
        "/v1/retrieve",
        json={"query": "busca"},
        headers=_auth_header(),
    )

    assert response.status_code == 200
    assert provider.calls == []
