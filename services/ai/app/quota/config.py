import os
from typing import Final, Literal

SCOPE_WEIGHTS: Final[dict[str, int]] = {"chat": 1, "action": 1, "generate": 3}
PLAN_LIMITS: Final[dict[str, int]] = {"FREE": 3, "PRO": 50, "VIP": -1}
KEY_TTL_SECONDS: Final[int] = 48 * 3600


def get_fail_mode() -> Literal["closed", "open"]:
    # TBD: a camada HTTP futura aplicara fail-open/closed ao mapear erros Redis.
    raw = os.getenv("QUOTA_FAIL_MODE", "closed").strip().lower()
    if raw == "open":
        return "open"
    return "closed"


def get_redis_url() -> str | None:
    raw = os.getenv("REDIS_URL")
    if raw is None:
        return None
    value = raw.strip()
    return value or None
