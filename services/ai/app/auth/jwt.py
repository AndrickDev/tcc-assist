import os
from typing import Literal, TypeAlias, cast

import jwt
from jwt import InvalidTokenError as PyJWTInvalidTokenError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.auth.exceptions import InvalidToken

Scope: TypeAlias = Literal["chat", "generate", "action", "quota"]
Plan: TypeAlias = Literal["FREE", "PRO", "VIP"]

_ISSUER = "tcc-assist-web"
_AUDIENCE = "tcc-assist-ai"
_SCOPES_WITH_TCC_ID: frozenset[Scope] = frozenset({"chat", "generate", "action"})


class InternalClaims(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    sub: str
    plan: Plan
    scope: Scope
    tcc_id: str | None = Field(default=None, alias="tccId")
    iat: int
    exp: int
    iss: str
    aud: str


def decode_internal_jwt(token: str, *, expected_scope: Scope) -> InternalClaims:
    secret = os.environ.get("INTERNAL_JWT_SECRET")
    if not secret:
        raise RuntimeError("INTERNAL_JWT_SECRET is required")

    try:
        raw_claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "scope", "plan"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise InvalidToken("expired") from exc
    except jwt.InvalidSignatureError as exc:
        raise InvalidToken("bad_signature") from exc
    except jwt.InvalidAlgorithmError as exc:
        raise InvalidToken("alg_not_allowed") from exc
    except PyJWTInvalidTokenError as exc:
        raise InvalidToken("malformed") from exc

    try:
        claims = InternalClaims.model_validate(cast(object, raw_claims))
    except ValidationError as exc:
        raise InvalidToken("malformed") from exc

    if claims.scope != expected_scope:
        raise InvalidToken("scope_mismatch")
    if claims.scope in _SCOPES_WITH_TCC_ID and not claims.tcc_id:
        raise InvalidToken("missing_tcc_id")
    if claims.scope == "quota" and claims.tcc_id is not None:
        raise InvalidToken("unexpected_tcc_id")

    return claims
