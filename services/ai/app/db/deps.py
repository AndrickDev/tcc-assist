import asyncpg

from app.db.pool import get_pool


async def get_pool_dep() -> asyncpg.Pool:
    return await get_pool()
