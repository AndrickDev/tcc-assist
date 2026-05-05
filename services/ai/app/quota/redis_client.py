from redis.asyncio import Redis

from app.quota.config import get_redis_url

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis

    if _redis is not None:
        return _redis

    redis_url = get_redis_url()
    if redis_url is None:
        raise RuntimeError("REDIS_URL ausente")

    _redis = Redis.from_url(
        redis_url,
        socket_connect_timeout=2,
        socket_timeout=2,
        decode_responses=True,
    )
    return _redis


async def close_redis() -> None:
    global _redis

    if _redis is None:
        return
    await _redis.aclose()
    _redis = None


def reset_for_tests() -> None:
    """Reset singleton state for tests only."""

    global _redis
    _redis = None

