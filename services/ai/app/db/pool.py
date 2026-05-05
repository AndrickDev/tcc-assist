import asyncpg

from app.db.config import (
    COMMAND_TIMEOUT_S,
    POOL_MAX_SIZE,
    POOL_MIN_SIZE,
    STATEMENT_TIMEOUT_MS,
    get_postgres_url,
)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool

    if _pool is not None:
        return _pool

    postgres_url = get_postgres_url()
    if postgres_url is None:
        raise RuntimeError("POSTGRES_URL ausente")

    _pool = await asyncpg.create_pool(
        postgres_url,
        min_size=POOL_MIN_SIZE,
        max_size=POOL_MAX_SIZE,
        command_timeout=COMMAND_TIMEOUT_S,
        server_settings={"statement_timeout": str(STATEMENT_TIMEOUT_MS)},
    )
    return _pool


async def close_pool() -> None:
    global _pool

    if _pool is None:
        return
    await _pool.close()
    _pool = None


def reset_for_tests() -> None:
    """Reset singleton state for tests only."""

    global _pool
    _pool = None
