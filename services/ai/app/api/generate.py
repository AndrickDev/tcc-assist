from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.orchestrator.generate import GenerateCitation, GenerateResult, run_generate
from app.providers.embedding import EmbeddingProvider, get_embedding_provider

router = APIRouter(tags=["generate"])


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tcc_id: str
    chapter: str = Field(min_length=1, max_length=5000)
    previous_context: str | None = Field(default=None, max_length=200000)
    require_sources: bool = False


class GenerateResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    content: str
    agent_id: str
    chapter: str
    references_used: int
    citations: list[GenerateCitation] = Field(default_factory=list)


@router.post("/generate", response_model=GenerateResponse)
async def generate_tcc(
    request: GenerateRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("generate"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis_client: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> GenerateResponse | JSONResponse:
    if claims.tcc_id != request.tcc_id:
        return JSONResponse(status_code=403, content={"error": "tcc_id_mismatch"})

    result: GenerateResult = await run_generate(
        pool=pool,
        redis_client=redis_client,
        provider=provider,
        user_id=claims.sub,
        plan=claims.plan,
        tcc_id=request.tcc_id,
        chapter=request.chapter,
        previous_context=request.previous_context,
        require_sources=request.require_sources,
    )
    return GenerateResponse(
        content=result.content,
        agent_id=result.agent_id,
        chapter=result.chapter,
        references_used=result.references_used,
        citations=result.citations,
    )
