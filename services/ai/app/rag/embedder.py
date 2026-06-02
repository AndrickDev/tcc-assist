from __future__ import annotations

from collections.abc import Sequence
from time import perf_counter

import structlog
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import embedding_cache

log = structlog.get_logger(__name__)


async def embed_texts(
    *,
    provider: EmbeddingProvider,
    redis: Redis,
    texts: Sequence[str],
) -> list[list[float]]:
    if not texts:
        return []

    started = perf_counter()
    cached = await embedding_cache.get_many(redis, provider.model, texts)
    misses_idx = [index for index, vector in enumerate(cached) if vector is None]
    if misses_idx:
        miss_texts = [texts[index] for index in misses_idx]
        embed_result = await provider.embed(miss_texts)
        fresh = embed_result.vectors
        await embedding_cache.set_many(
            redis,
            provider.model,
            list(zip(miss_texts, fresh, strict=True)),
        )
        for index, vector in zip(misses_idx, fresh, strict=True):
            cached[index] = vector

    out = [vector for vector in cached if vector is not None]
    if len(out) != len(texts):
        raise RuntimeError("cache fill inconsistente apos embed")

    log.info(
        "embed_texts_done",
        n_input=len(texts),
        n_cache_hits=len(texts) - len(misses_idx),
        elapsed_ms=int((perf_counter() - started) * 1000),
    )
    return out
