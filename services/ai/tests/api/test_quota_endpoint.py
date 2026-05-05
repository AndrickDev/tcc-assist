from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import cast

import fakeredis.aioredis
import jwt
import pytest
import redis
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.main import create_app

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


def _today_key(user_id: str) -> str:
    return f"quota:{user_id}:{datetime.now(UTC).strftime('%Y-%m-%d')}"


def _make_token(
    *,
    scope: str = "quota",
    plan: str = "PRO",
    secret: str = SECRET,
    **overrides: object,
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
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm="HS256")


def _client_with_redis(redis_client: Redis) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_redis_dep] = lambda: redis_client
    return TestClient(app)


async def test_quota_me_retorna_estado_pro_com_uso(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    await fake_redis.set(_today_key("user-1"), "5")
    client = _client_with_redis(cast(Redis, fake_redis))

    response = client.get("/v1/quota/me", headers={"Authorization": f"Bearer {_make_token()}"})

    assert response.status_code == 200
    assert response.json() == {
        "used": 5,
        "limit": 50,
        "remaining": 45,
        "reset_at": response.json()["reset_at"],
    }
    assert response.json()["reset_at"].endswith("Z")


async def test_quota_me_sem_chave_retorna_zero(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_redis(cast(Redis, fake_redis))

    response = client.get("/v1/quota/me", headers={"Authorization": f"Bearer {_make_token()}"})

    assert response.status_code == 200
    body = response.json()
    assert body["used"] == 0
    assert body["limit"] == 50
    assert body["remaining"] == 50


async def test_quota_me_vip_retorna_ilimitado(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    await fake_redis.set(_today_key("user-1"), "300")
    client = _client_with_redis(cast(Redis, fake_redis))

    response = client.get(
        "/v1/quota/me",
        headers={"Authorization": f"Bearer {_make_token(plan='VIP')}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["used"] == 300
    assert body["limit"] == -1
    assert body["remaining"] == -1


async def test_quota_me_sem_header_retorna_401(
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    client = _client_with_redis(cast(Redis, fake_redis))

    response = client.get("/v1/quota/me")

    assert response.status_code == 401
    assert response.json() == {"error": "missing_token"}


async def test_quota_me_token_scope_errado_retorna_401(
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_redis(cast(Redis, fake_redis))
    token = _make_token(scope="chat", tccId="tcc-1")

    response = client.get("/v1/quota/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


class FailingRedis:
    async def get(self, key: str) -> str | None:
        raise redis.RedisError("boom")


async def test_quota_me_redis_falha_retorna_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_redis(cast(Redis, FailingRedis()))

    response = client.get("/v1/quota/me", headers={"Authorization": f"Bearer {_make_token()}"})

    assert response.status_code == 503
    assert response.json() == {"error": "quota_backend_unavailable"}
