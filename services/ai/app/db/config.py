import os
from typing import Final

POOL_MIN_SIZE: Final[int] = 1
POOL_MAX_SIZE: Final[int] = 5
STATEMENT_TIMEOUT_MS: Final[int] = 10_000
COMMAND_TIMEOUT_S: Final[int] = 10


def get_postgres_url() -> str | None:
    raw = os.getenv("POSTGRES_URL")
    if raw is None:
        return None
    value = raw.strip()
    return value or None
