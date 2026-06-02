from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from typing import Final

import structlog
from redis.asyncio import Redis

DEFAULT_TTL_S: Final[int] = 60 * 60 * 24 * 30

log = structlog.get_logger(__name__)


def cache_key(model: str, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"embed:{model}:{digest}"


async def get_many(
    redis: Redis,
    model: str,
    texts: Sequence[str],
) -> list[list[float] | None]:
    if not texts:
        return []

    keys = [cache_key(model, text) for text in texts]
    raw = await redis.mget(keys)
    result: list[list[float] | None] = []
    for item in raw:
        if item is None:
            result.append(None)
            continue
        try:
            decoded = item.decode("utf-8") if isinstance(item, bytes) else item
            parsed = json.loads(decoded)
            if not isinstance(parsed, list):
                result.append(None)
                continue
            result.append([float(value) for value in parsed])
        except (TypeError, ValueError):
            result.append(None)
    return result


async def set_many(
    redis: Redis,
    model: str,
    pairs: Sequence[tuple[str, list[float]]],
    ttl_s: int = DEFAULT_TTL_S,
) -> None:
    if not pairs:
        return

    async with redis.pipeline(transaction=False) as pipe:
        for text, vector in pairs:
            await pipe.set(cache_key(model, text), json.dumps(vector), ex=ttl_s)
        await pipe.execute()
