from typing import Literal

AuthDetail = Literal[
    "expired",
    "bad_signature",
    "scope_mismatch",
    "missing_tcc_id",
    "unexpected_tcc_id",
    "alg_not_allowed",
    "malformed",
]


class AuthError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class MissingToken(AuthError):
    def __init__(self) -> None:
        super().__init__("missing_token")


class InvalidToken(AuthError):
    def __init__(self, detail: AuthDetail) -> None:
        super().__init__(detail)
