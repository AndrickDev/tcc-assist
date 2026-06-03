from __future__ import annotations

from time import perf_counter
from uuid import UUID

import asyncpg
import structlog
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import chunker, embedder, pdf_extract, repository

log = structlog.get_logger(__name__)


async def run_pdf_ingestion(
    *,
    pool: asyncpg.Pool,
    redis: Redis,
    provider: EmbeddingProvider,
    job_id: UUID,
    tcc_id: str,
    file_url: str,
) -> None:
    started = perf_counter()
    try:
        await repository.update_ingestion_status(pool, job_id=job_id, status="running")
        pdf_bytes = await pdf_extract.fetch_pdf(file_url)
        pages = pdf_extract.extract_pages(pdf_bytes)
        chunks = chunker.chunk_pages(pages)
        if not chunks:
            await repository.update_ingestion_status(
                pool, job_id=job_id, status="done", error=None
            )
            log.info("ingest_pdf_empty", job_id=str(job_id), pages=len(pages))
            return

        vectors = await embedder.embed_texts(provider=provider, redis=redis, texts=chunks)
        token_counts = [chunker.approx_token_count(chunk) for chunk in chunks]
        inserted = await repository.insert_chunks_with_embeddings(
            pool,
            job_id=job_id,
            tcc_id=tcc_id,
            source_type="pdf",
            source_ref=str(job_id),
            chunks=chunks,
            vectors=vectors,
            model=provider.model,
            dim=provider.dim,
            token_counts=token_counts,
        )
        await repository.update_ingestion_status(pool, job_id=job_id, status="done")
        log.info(
            "ingest_pdf_done",
            job_id=str(job_id),
            chunks=inserted,
            elapsed_ms=int((perf_counter() - started) * 1000),
        )
    except Exception as exc:
        await repository.update_ingestion_status(
            pool, job_id=job_id, status="failed", error=str(exc)[:500]
        )
        log.error(
            "ingest_pdf_failed",
            job_id=str(job_id),
            error=str(exc),
            elapsed_ms=int((perf_counter() - started) * 1000),
        )


async def run_reference_ingestion(
    *,
    pool: asyncpg.Pool,
    redis: Redis,
    provider: EmbeddingProvider,
    job_id: UUID,
    tcc_id: str,
    reference_id: str,
    title: str,
    abstract: str,
) -> None:
    started = perf_counter()
    try:
        await repository.update_ingestion_status(pool, job_id=job_id, status="running")
        text = _compose_reference_text(title=title, abstract=abstract)
        chunks = chunker.chunk_text(text)
        if not chunks:
            await repository.update_ingestion_status(
                pool, job_id=job_id, status="done", error=None
            )
            log.info("ingest_reference_empty", job_id=str(job_id), reference_id=reference_id)
            return

        vectors = await embedder.embed_texts(provider=provider, redis=redis, texts=chunks)
        token_counts = [chunker.approx_token_count(chunk) for chunk in chunks]
        inserted = await repository.insert_chunks_with_embeddings(
            pool,
            job_id=job_id,
            tcc_id=tcc_id,
            source_type="openalex",
            source_ref=reference_id,
            chunks=chunks,
            vectors=vectors,
            model=provider.model,
            dim=provider.dim,
            token_counts=token_counts,
        )
        await repository.update_ingestion_status(pool, job_id=job_id, status="done")
        log.info(
            "ingest_reference_done",
            job_id=str(job_id),
            reference_id=reference_id,
            chunks=inserted,
            elapsed_ms=int((perf_counter() - started) * 1000),
        )
    except Exception as exc:
        await repository.update_ingestion_status(
            pool, job_id=job_id, status="failed", error=str(exc)[:500]
        )
        log.error(
            "ingest_reference_failed",
            job_id=str(job_id),
            reference_id=reference_id,
            error=str(exc),
            elapsed_ms=int((perf_counter() - started) * 1000),
        )


def _compose_reference_text(*, title: str, abstract: str) -> str:
    pieces = [piece.strip() for piece in (title, abstract) if piece and piece.strip()]
    return "\n\n".join(pieces)
