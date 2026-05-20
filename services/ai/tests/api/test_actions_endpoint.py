from datetime import UTC, datetime, timedelta
from typing import cast

import asyncpg
import jwt
import pytest
from fastapi.testclient import TestClient

from app.api import actions as actions_api
from app.db.deps import get_pool_dep
from app.main import create_app
from app.orchestrator.actions import ActionResult, FreePlanForbidden
from app.orchestrator.exceptions import TccNotFoundOrForbidden

SECRET = "test-secret-with-at-least-32-bytes"


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _make_token(
    *,
    scope: str = "action",
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


def _client_with_dummy_deps() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: cast(asyncpg.Pool, object())
    return TestClient(app)


def test_action_sem_token_retorna_401() -> None:
    client = TestClient(create_app())

    response = client.post("/v1/actions/revisar", json={"tcc_id": "tcc-1", "text": "Oi"})

    assert response.status_code == 401
    assert response.json() == {"error": "missing_token"}


def test_action_token_scope_errado_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = TestClient(create_app())
    token = _make_token(scope="chat")

    response = client.post(
        "/v1/actions/revisar",
        json={"tcc_id": "tcc-1", "text": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_action_happy_200(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fake_run_action(**_kwargs: object) -> ActionResult:
        return ActionResult(result="<p>ok</p>")

    monkeypatch.setattr(actions_api, "run_action", fake_run_action)
    client = _client_with_dummy_deps()
    token = _make_token()

    response = client.post(
        "/v1/actions/revisar",
        json={"tcc_id": "tcc-1", "text": "<p>x</p>", "context": "ctx"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"result": "<p>ok</p>"}


def test_action_tcc_id_mismatch_retorna_403(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token(tcc_id="tcc-1")

    response = client.post(
        "/v1/actions/revisar",
        json={"tcc_id": "tcc-2", "text": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"error": "tcc_id_mismatch"}


def test_action_free_plan_forbidden_retorna_403(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fake_run_action(**_kwargs: object) -> ActionResult:
        raise FreePlanForbidden

    monkeypatch.setattr(actions_api, "run_action", fake_run_action)
    client = _client_with_dummy_deps()
    token = _make_token(plan="FREE")

    response = client.post(
        "/v1/actions/abnt",
        json={"tcc_id": "tcc-1", "text": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"error": "free_plan_forbidden"}


def test_action_tcc_not_found_retorna_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fake_run_action(**_kwargs: object) -> ActionResult:
        raise TccNotFoundOrForbidden("tcc_not_found")

    monkeypatch.setattr(actions_api, "run_action", fake_run_action)
    client = _client_with_dummy_deps()
    token = _make_token()

    response = client.post(
        "/v1/actions/citacoes",
        json={"tcc_id": "tcc-1", "text": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json() == {"error": "tcc_not_found"}


def test_action_unknown_path_retorna_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token()

    response = client.post(
        "/v1/actions/desconhecida",
        json={"tcc_id": "tcc-1", "text": "Oi"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_action_body_invalido_retorna_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = _client_with_dummy_deps()
    token = _make_token()

    response = client.post(
        "/v1/actions/proximopasso",
        json={"tcc_id": "tcc-1", "text": "", "extra": "x"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
