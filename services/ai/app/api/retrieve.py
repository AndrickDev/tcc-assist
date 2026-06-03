from __future__ import annotations

from typing import Annotated, Final, cast

import asyncpg
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.providers.embedding import EmbeddingProvider, get_embedding_provider
from app.rag import embedder, repository

log = structlog.get_logger(__name__)

DEFAULT_TOP_K: Final[int] = 8
MAX_TOP_K: Final[int] = 50
ALLOWED_SOURCE_TYPES: Final[frozenset[str]] = frozenset({"pdf", "openalex"})

router = APIRouter(prefix="/v1/retrieve", tags=["retrieve"])


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=MAX_TOP_K)
    source_types: list[str] | None = None


class RetrievedChunk(BaseModel):
    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    content: str
    metadata: dict[str, object]
    score: float


class RetrieveResponse(BaseModel):
    query: str
    model: str
    chunks: list[RetrievedChunk]


@router.post("", response_model=RetrieveResponse, status_code=status.HTTP_200_OK)
async def post_retrieve(
    body: RetrieveRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("retrieve"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> RetrieveResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    if body.source_types is not None:
        invalid = [source for source in body.source_types if source not in ALLOWED_SOURCE_TYPES]
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=f"invalid_source_types:{','.join(invalid)}",
            )

    vectors = await embedder.embed_texts(provider=provider, redis=redis, texts=[body.query])
    if not vectors:
        return RetrieveResponse(query=body.query, model=provider.model, chunks=[])
    query_vector = vectors[0]

    rows = await repository.search_similar_chunks(
        pool,
        tcc_id=claims.tcc_id,
        query_vector=query_vector,
        top_k=body.top_k,
        source_types=body.source_types,
    )

    chunks = [
        RetrievedChunk(
            chunk_id=str(row["chunk_id"]),
            source_type=str(row["source_type"]),
            source_ref=str(row["source_ref"]),
            ordinal=int(cast(int, row["ordinal"])),
            content=str(row["content"]),
            metadata=cast(dict[str, object], row["metadata"])
            if isinstance(row["metadata"], dict)
            else {},
            score=float(cast(float, row["score"])),
        )
        for row in rows
    ]
    log.info(
        "retrieve_done",
        tcc_id=claims.tcc_id,
        top_k=body.top_k,
        n_results=len(chunks),
        source_types=body.source_types,
    )
    return RetrieveResponse(query=body.query, model=provider.model, chunks=chunks)
