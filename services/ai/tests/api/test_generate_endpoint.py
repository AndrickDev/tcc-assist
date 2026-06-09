from collections.abc import AsyncIterator, Sequence
from datetime import UTC, datetime, timedelta
from typing import cast

import asyncpg
import fakeredis.aioredis
import jwt
import pytest
import respx
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.db.deps import get_pool_dep
from app.main import create_app
from app.providers.embedding import EmbeddingProvider, EmbedResult, get_embedding_provider
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL

SECRET = "test-secret-with-at-least-32-bytes"


class FakeEmbeddingProvider:
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


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _make_token(
    *,
    scope: str = "generate",
    tcc_id: str | None = "tcc-1",
    plan: str = "PRO",
) -> str:
    claims: dict[str, object] = {
        "sub": "user-1",
        "plan": plan,
        "scope": scope,
        "iat": _timestamp(timedelta(minutes=-1)),
        "exp": _timestamp(timedelta(minutes=5)),
        "iss": "tcc-assist-web",
        "aud": "tcc-assist-ai",
    }
    if tcc_id is not None:
        claims["tccId"] = tcc_id
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _client_with_deps(pool: asyncpg.Pool, redis_client: Redis) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: pool
    app.dependency_overrides[get_redis_dep] = lambda: redis_client
    app.dependency_overrides[get_embedding_provider] = lambda: cast(
        EmbeddingProvider,
        FakeEmbeddingProvider(),
    )
    return TestClient(app)


def _client_with_dummy_deps() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: cast(asyncpg.Pool, object())
    app.dependency_overrides[get_redis_dep] = lambda: cast(Redis, object())
    app.dependency_overrides[get_embedding_provider] = lambda: cast(
        EmbeddingProvider,
        FakeEmbeddingProvider(),
    )
    return TestClient(app)


def test_generate_sem_token_retorna_401() -> None:
    client = TestClient(create_app())

    response = client.post("/v1/generate", json={"tcc_id": "tcc-1", "chapter": "Intro"})

    assert response.status_code == 401
    assert response.json() == {"error": "missing_token"}


def test_generate_token_scope_errado_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = TestClient(create_app())
    token = _make_token(scope="chat")

    response = client.post(
        "/v1/generate",
        json={"tcc_id": "tcc-1", "chapter": "Intro"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_generate_tcc_id_mismatch_retorna_403(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token(tcc_id="tcc-1")

    response = client.post(
        "/v1/generate",
        json={"tcc_id": "tcc-2", "chapter": "Intro"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"error": "tcc_id_mismatch"}


async def test_generate_endpoint_happy_200(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    client = _client_with_deps(postgres_pool, cast(Redis, fake_redis))
    token = _make_token()
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "<p>ok</p>"}]}}]},
        )

        response = client.post(
            "/v1/generate",
            json={
                "tcc_id": "tcc-1",
                "chapter": "Introdução",
                "previous_context": "Contexto",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "content": "<p>ok</p>",
        "agent_id": "redator-pro",
        "chapter": "Introdução",
        "references_used": 3,
        "citations": [],
    }


async def test_generate_require_sources_true_sem_base_retorna_422(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    client = _client_with_deps(postgres_pool, cast(Redis, fake_redis))
    token = _make_token(tcc_id="tcc-empty")

    response = client.post(
        "/v1/generate",
        json={"tcc_id": "tcc-empty", "chapter": "Intro", "require_sources": True},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
    assert response.json() == {"error": "insufficient_sources"}


async def test_generate_require_sources_false_sem_rag_gera_mesmo_assim(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    client = _client_with_deps(postgres_pool, cast(Redis, fake_redis))
    token = _make_token(tcc_id="tcc-empty")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "<p>sem fontes</p>"}]}}]},
        )

        response = client.post(
            "/v1/generate",
            json={"tcc_id": "tcc-empty", "chapter": "Intro"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["content"] == "<p>sem fontes</p>"
    assert response.json()["references_used"] == 0
    assert response.json()["citations"] == []
