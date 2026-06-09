import asyncio
from collections.abc import Sequence
from time import perf_counter
from typing import Literal

import asyncpg
import structlog
from pydantic import BaseModel, ConfigDict, Field
from redis.asyncio import Redis

from app.db.models import TccMetadata
from app.db.tcc_repo import get_tcc_metadata, list_selected_references
from app.orchestrator.exceptions import TccNotFoundOrForbidden
from app.orchestrator.rag_block import build_rag_context_block
from app.orchestrator.references import build_references_block
from app.prompts.chat import Plan, TccMetadataInput
from app.prompts.generate import GeneratePromptInput, build_generate_prompt
from app.providers.embedding import EmbeddingProvider
from app.providers.gemini import generate, get_config_for_plan
from app.providers.postprocess import strip_code_fences
from app.rag.chat_retrieval import ChatRagChunk, retrieve_for_chat

AgentId = Literal["redator-pro"]

log = structlog.get_logger(__name__)


class GenerateCitation(BaseModel):
    model_config = ConfigDict(frozen=True)

    n: int
    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    score: float
    excerpt: str


class GenerateResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    content: str
    agent_id: AgentId = "redator-pro"
    chapter: str
    references_used: int
    citations: list[GenerateCitation] = Field(default_factory=list)


class InsufficientSources(Exception):
    """Raised when generate requires sources but neither RAG nor references exist."""


async def run_generate(
    *,
    pool: asyncpg.Pool,
    redis_client: Redis,
    provider: EmbeddingProvider,
    user_id: str,
    plan: Plan,
    tcc_id: str,
    chapter: str,
    previous_context: str | None,
    require_sources: bool,
) -> GenerateResult:
    started = perf_counter()
    log.info("generate_started", user_id=user_id, plan=plan, tcc_id=tcc_id, chapter=chapter)
    try:
        tcc_metadata = await get_tcc_metadata(pool=pool, tcc_id=tcc_id, user_id=user_id)
        if tcc_metadata is None:
            raise TccNotFoundOrForbidden("tcc_not_found")

        refs_task = list_selected_references(pool=pool, tcc_id=tcc_id)
        rag_task = _retrieve_for_generate_safely(
            pool=pool,
            redis_client=redis_client,
            provider=provider,
            tcc_id=tcc_id,
            chapter=chapter,
            previous_context=previous_context,
        )
        refs, rag_chunks = await asyncio.gather(refs_task, rag_task)

        if require_sources and not refs and not rag_chunks:
            raise InsufficientSources("insufficient_sources")

        prompt = build_generate_prompt(
            GeneratePromptInput(
                plan=plan,
                tcc_metadata=_to_prompt_metadata(tcc_metadata),
                chapter=chapter,
                previous_context=previous_context,
                references_block=build_references_block(refs),
                rag_context_block=build_rag_context_block(rag_chunks),
            )
        )
        raw_content = await generate(prompt=prompt, config=get_config_for_plan(plan))
        result = GenerateResult(
            content=strip_code_fences(raw_content),
            chapter=chapter,
            references_used=len(refs),
            citations=_to_citations(rag_chunks),
        )
        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info(
            "generate_completed",
            user_id=user_id,
            plan=plan,
            tcc_id=tcc_id,
            chapter=chapter,
            latency_ms=latency_ms,
        )
        return result
    except Exception:
        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info(
            "generate_failed",
            user_id=user_id,
            plan=plan,
            tcc_id=tcc_id,
            chapter=chapter,
            latency_ms=latency_ms,
        )
        raise


def _to_prompt_metadata(metadata: TccMetadata) -> TccMetadataInput:
    return TccMetadataInput(
        title=metadata.title,
        course=metadata.course,
        institution=metadata.institution,
        work_type=metadata.work_type,
        norma=metadata.norma,
        objective=metadata.objective,
    )


async def _retrieve_for_generate_safely(
    *,
    pool: asyncpg.Pool,
    redis_client: Redis,
    provider: EmbeddingProvider,
    tcc_id: str,
    chapter: str,
    previous_context: str | None,
) -> list[ChatRagChunk]:
    query = chapter if not previous_context else f"{chapter}\n\n{previous_context}"
    try:
        return await retrieve_for_chat(
            pool=pool,
            redis=redis_client,
            provider=provider,
            tcc_id=tcc_id,
            query=query,
        )
    except Exception as exc:
        log.warning("generate_rag_unexpected_failed", tcc_id=tcc_id, error=str(exc))
        return []


def _to_citations(chunks: Sequence[ChatRagChunk]) -> list[GenerateCitation]:
    return [
        GenerateCitation(
            n=index,
            chunk_id=chunk.chunk_id,
            source_type=chunk.source_type,
            source_ref=chunk.source_ref,
            ordinal=chunk.ordinal,
            score=chunk.score,
            excerpt=chunk.content[:200],
        )
        for index, chunk in enumerate(chunks, start=1)
    ]
