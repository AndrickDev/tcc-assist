from __future__ import annotations

from time import perf_counter
from typing import Final, cast

import asyncpg
import structlog
from pydantic import BaseModel, ConfigDict
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import embedder, repository

DEFAULT_TOP_K: Final[int] = 5
DEFAULT_SCORE_THRESHOLD: Final[float] = 0.5
DEFAULT_MAX_CHARS: Final[int] = 6000

log = structlog.get_logger(__name__)


class ChatRagChunk(BaseModel):
    model_config = ConfigDict(frozen=True)

    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    content: str
    score: float


async def retrieve_for_chat(
    *,
    pool: asyncpg.Pool,
    redis: Redis,
    provider: EmbeddingProvider,
    tcc_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
    score_threshold: float = DEFAULT_SCORE_THRESHOLD,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> list[ChatRagChunk]:
    """Embed query, search pgvector, filter by score and char budget."""
    started = perf_counter()
    cleaned = query.strip()
    if not cleaned:
        return []

    try:
        vectors = await embedder.embed_texts(provider=provider, redis=redis, texts=[cleaned])
    except Exception as exc:
        log.warning("chat_rag_embed_failed", error=str(exc))
        return []
    if not vectors:
        return []

    try:
        rows = await repository.search_similar_chunks(
            pool,
            tcc_id=tcc_id,
            query_vector=vectors[0],
            top_k=top_k,
        )
    except Exception as exc:
        log.warning("chat_rag_search_failed", tcc_id=tcc_id, error=str(exc))
        return []

    filtered: list[ChatRagChunk] = []
    spent = 0
    for row in rows:
        score = float(cast(float | int | str, row["score"]))
        if score < score_threshold:
            continue
        content = str(row["content"])
        if spent + len(content) > max_chars and filtered:
            break
        filtered.append(
            ChatRagChunk(
                chunk_id=str(row["chunk_id"]),
                source_type=str(row["source_type"]),
                source_ref=str(row["source_ref"]),
                ordinal=int(cast(float | int | str, row["ordinal"])),
                content=content,
                score=score,
            )
        )
        spent += len(content)

    log.info(
        "chat_rag_retrieved",
        tcc_id=tcc_id,
        candidates=len(rows),
        kept=len(filtered),
        spent_chars=spent,
        elapsed_ms=int((perf_counter() - started) * 1000),
    )
    return filtered
