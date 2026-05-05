from collections.abc import Callable
from typing import Annotated

from fastapi import Header

from app.auth.exceptions import MissingToken
from app.auth.jwt import InternalClaims, Scope, decode_internal_jwt


def require_scope(scope: Scope) -> Callable[..., InternalClaims]:
    def dependency(
        authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    ) -> InternalClaims:
        if authorization is None or not authorization.startswith("Bearer "):
            raise MissingToken()

        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise MissingToken()

        return decode_internal_jwt(token, expected_scope=scope)

    return dependency
