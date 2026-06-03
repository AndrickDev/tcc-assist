from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.deps import require_scope
from app.auth.exceptions import InvalidToken, MissingToken
from app.auth.jwt import InternalClaims, decode_internal_jwt
from app.main import invalid_token_handler, missing_token_handler

SECRET = "test-secret-with-at-least-32-bytes"
OTHER_SECRET = "other-test-secret-with-at-least-32-bytes"


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _make_token(
    *,
    secret: str = SECRET,
    algorithm: str | None = "HS256",
    **overrides: object,
) -> str:
    claims: dict[str, object] = {
        "sub": "user-1",
        "plan": "PRO",
        "scope": "quota",
        "iat": _timestamp(timedelta(minutes=-1)),
        "exp": _timestamp(timedelta(minutes=5)),
        "iss": "tcc-assist-web",
        "aud": "tcc-assist-ai",
    }
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm=algorithm)


def test_decode_quota_token_sem_tcc_id_retorna_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="quota")

    claims = decode_internal_jwt(token, expected_scope="quota")

    assert claims.sub == "user-1"
    assert claims.plan == "PRO"
    assert claims.scope == "quota"
    assert claims.tcc_id is None


def test_decode_chat_token_com_tcc_id_retorna_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="chat", tccId="tcc-1")

    claims = decode_internal_jwt(token, expected_scope="chat")

    assert claims.scope == "chat"
    assert claims.tcc_id == "tcc-1"


def test_decode_ingest_token_com_tcc_id_retorna_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="ingest", tccId="tcc-1")

    claims = decode_internal_jwt(token, expected_scope="ingest")

    assert claims.scope == "ingest"
    assert claims.tcc_id == "tcc-1"


def test_decode_assinatura_errada_levanta_bad_signature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(secret=OTHER_SECRET)

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="quota")

    assert exc_info.value.detail == "bad_signature"


def test_decode_token_expirado_levanta_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(exp=_timestamp(timedelta(minutes=-5)))

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="quota")

    assert exc_info.value.detail == "expired"


def test_decode_aud_errado_levanta_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(aud="wrong-audience")

    with pytest.raises(InvalidToken):
        decode_internal_jwt(token, expected_scope="quota")


def test_decode_iss_errado_levanta_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(iss="wrong-issuer")

    with pytest.raises(InvalidToken):
        decode_internal_jwt(token, expected_scope="quota")


def test_decode_alg_none_rejeitado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(secret="", algorithm="none")

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="quota")

    assert exc_info.value.detail == "alg_not_allowed"


def test_decode_scope_errado_levanta_scope_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="quota")

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="chat")

    assert exc_info.value.detail == "scope_mismatch"


def test_decode_chat_sem_tcc_id_levanta_missing_tcc_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="chat")

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="chat")

    assert exc_info.value.detail == "missing_tcc_id"


def test_decode_quota_com_tcc_id_levanta_unexpected_tcc_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    token = _make_token(scope="quota", tccId="tcc-1")

    with pytest.raises(InvalidToken) as exc_info:
        decode_internal_jwt(token, expected_scope="quota")

    assert exc_info.value.detail == "unexpected_tcc_id"


def test_require_scope_sem_header_levanta_missing_token() -> None:
    dependency = require_scope("quota")

    with pytest.raises(MissingToken):
        dependency()


@pytest.mark.parametrize("authorization", ["Token abc", "Bearer ", "Bearer   "])
def test_require_scope_header_invalido_levanta_missing_token(authorization: str) -> None:
    dependency = require_scope("quota")

    with pytest.raises(MissingToken):
        dependency(authorization=authorization)


def _create_test_app() -> FastAPI:
    app = FastAPI()
    app.add_exception_handler(MissingToken, missing_token_handler)
    app.add_exception_handler(InvalidToken, invalid_token_handler)
    quota_dependency = require_scope("quota")

    @app.get("/dummy")
    def dummy(
        claims: Annotated[InternalClaims, Depends(quota_dependency)],
    ) -> dict[str, str]:
        return {"sub": claims.sub}

    return app


def test_integracao_sem_header_retorna_401_missing_token() -> None:
    client = TestClient(_create_test_app())

    response = client.get("/dummy")

    assert response.status_code == 401
    assert response.json() == {"error": "missing_token"}


def test_integracao_token_expirado_retorna_401_invalid_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    client = TestClient(_create_test_app())
    token = _make_token(exp=_timestamp(timedelta(minutes=-5)))

    response = client.get("/dummy", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "expired"}
