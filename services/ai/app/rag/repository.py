from __future__ import annotations

from collections.abc import Sequence
from typing import Literal
from uuid import UUID

import asyncpg
import structlog

log = structlog.get_logger(__name__)

SourceType = Literal["pdf", "openalex"]
JobStatus = Literal["pending", "running", "done", "failed"]


async def create_ingestion_job(
    pool: asyncpg.Pool,
    *,
    tcc_id: str,
    source_type: SourceType,
    source_ref: str,
) -> UUID:
    query = """
        INSERT INTO ingestion_jobs (tcc_id, source_type, source_ref, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id
    """
    row = await pool.fetchrow(query, tcc_id, source_type, source_ref)
    return UUID(str(row["id"]))


async def update_ingestion_status(
    pool: asyncpg.Pool,
    *,
    job_id: UUID,
    status: JobStatus,
    error: str | None = None,
) -> None:
    query = """
        UPDATE ingestion_jobs
        SET status = $2, error = $3, updated_at = now()
        WHERE id = $1
    """
    await pool.execute(query, job_id, status, error)


async def get_ingestion_job(
    pool: asyncpg.Pool,
    *,
    job_id: UUID,
    tcc_id: str,
) -> dict[str, object] | None:
    query = """
        SELECT id, tcc_id, source_type, source_ref, status, error,
               created_at, updated_at,
               (
                   SELECT count(*)
                   FROM chunks
                   WHERE ingestion_job_id = ingestion_jobs.id
               ) AS chunk_count
        FROM ingestion_jobs
        WHERE id = $1 AND tcc_id = $2
    """
    row = await pool.fetchrow(query, job_id, tcc_id)
    return dict(row) if row else None


def _format_vector(vector: Sequence[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in vector) + "]"


async def insert_chunks_with_embeddings(
    pool: asyncpg.Pool,
    *,
    job_id: UUID,
    tcc_id: str,
    source_type: SourceType,
    source_ref: str,
    chunks: Sequence[str],
    vectors: Sequence[Sequence[float]],
    model: str,
    dim: int,
    token_counts: Sequence[int],
) -> int:
    if len(chunks) != len(vectors) or len(chunks) != len(token_counts):
        raise ValueError("chunks/vectors/token_counts length mismatch")
    inserted = 0
    async with pool.acquire() as conn, conn.transaction():
        for ordinal, (content, vec, tokens) in enumerate(
            zip(chunks, vectors, token_counts, strict=True)
        ):
            chunk_row = await conn.fetchrow(
                """
                INSERT INTO chunks (
                    ingestion_job_id, tcc_id, source_type, source_ref,
                    ordinal, content, token_count
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                job_id,
                tcc_id,
                source_type,
                source_ref,
                ordinal,
                content,
                tokens,
            )
            await conn.execute(
                """
                INSERT INTO embeddings (chunk_id, model, dim, vector)
                VALUES ($1, $2, $3, $4::vector)
                """,
                chunk_row["id"],
                model,
                dim,
                _format_vector(vec),
            )
            inserted += 1
    return inserted


async def fetch_attachment_url(
    pool: asyncpg.Pool,
    *,
    attachment_id: str,
    tcc_id: str,
) -> dict[str, str] | None:
    query = """
        SELECT id, "fileUrl" AS file_url, "fileName" AS file_name, "mimeType" AS mime_type
        FROM "Attachment"
        WHERE id = $1 AND "tccId" = $2
    """
    row = await pool.fetchrow(query, attachment_id, tcc_id)
    return {key: str(value) for key, value in dict(row).items()} if row else None
