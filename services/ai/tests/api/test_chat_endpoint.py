from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import cast

import asyncpg
import fakeredis.aioredis
import jwt
import pytest
import redis
import respx
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.db.deps import get_pool_dep
from app.main import create_app
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL

SECRET = "test-secret-with-at-least-32-bytes"


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _quota_key(user_id: str) -> str:
    return f"quota:{user_id}:{datetime.now(UTC).strftime('%Y-%m-%d')}"


def _make_token(
    *,
    scope: str = "chat",
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
    return TestClient(app)


def _client_with_dummy_deps() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: cast(asyncpg.Pool, object())
    app.dependency_overrides[get_redis_dep] = lambda: cast(Redis, object())
    return TestClient(app)


def test_chat_sem_token_retorna_401() -> None:
    client = TestClient(create_app())

    response = client.post("/v1/chat", json={"tcc_id": "tcc-1", "message": "Oi"})

    assert response.status_code == 401
    assert response.json() == {"error": "missing_token"}


def test_chat_token_scope_errado_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = TestClient(create_app())
    token = _make_token(scope="quota", tcc_id=None)

    response = client.post(
        "/v1/chat",
        json={"tcc_id": "tcc-1", "message": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_chat_tcc_id_mismatch_retorna_403(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token(tcc_id="tcc-1")

    response = client.post(
        "/v1/chat",
        json={"tcc_id": "tcc-2", "message": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"error": "tcc_id_mismatch"}


def test_chat_message_vazio_retorna_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token()

    response = client.post(
        "/v1/chat",
        json={"tcc_id": "tcc-1", "message": ""},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


async def test_chat_happy_200(
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
            "/v1/chat",
            json={"tcc_id": "tcc-1", "message": "Oi"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["content"] == "<p>ok</p>"
    assert response.json()["agent_id"] == "redator-pro"
    assert response.json()["quota"]["remaining"] == 49


async def test_chat_quota_excedida_retorna_429(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    await fake_redis.set(_quota_key("user-1"), "3")
    client = _client_with_deps(postgres_pool, cast(Redis, fake_redis))
    token = _make_token(plan="FREE")

    response = client.post(
        "/v1/chat",
        json={"tcc_id": "tcc-1", "message": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 429
    assert response.json()["error"] == "quota_exceeded"
    assert response.json()["remaining"] == 0


class FailingRedis:
    def pipeline(self, transaction: bool = True) -> "FailingRedis":
        raise redis.RedisError("boom")


async def test_chat_redis_indisponivel_retorna_503(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_deps(postgres_pool, cast(Redis, FailingRedis()))
    token = _make_token()

    response = client.post(
        "/v1/chat",
        json={"tcc_id": "tcc-1", "message": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 503
    assert response.json() == {"error": "quota_backend_unavailable"}
