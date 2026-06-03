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


async def search_similar_chunks(
    pool: asyncpg.Pool,
    *,
    tcc_id: str,
    query_vector: Sequence[float],
    top_k: int,
    source_types: Sequence[str] | None = None,
) -> list[dict[str, object]]:
    """Top-k chunks by cosine similarity for the given tcc.

    Vetores armazenados sao normalizados (T-G2.1), portanto
    1 - cosine_distance fica em [0, 1], com 1 = match perfeito.
    """
    if top_k <= 0:
        return []
    vector_str = _format_vector(query_vector)
    types_filter = list(source_types) if source_types else None
    query = """
        SELECT
            c.id AS chunk_id,
            c.tcc_id,
            c.source_type,
            c.source_ref,
            c.ordinal,
            c.content,
            c.metadata,
            1 - (e.vector <=> $1::vector) AS score
        FROM embeddings e
        JOIN chunks c ON c.id = e.chunk_id
        WHERE c.tcc_id = $2
          AND ($3::text[] IS NULL OR c.source_type = ANY($3::text[]))
        ORDER BY e.vector <=> $1::vector
        LIMIT $4
    """
    rows = await pool.fetch(query, vector_str, tcc_id, types_filter, top_k)
    return [dict(row) for row in rows]


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


async def fetch_reference_for_ingest(
    pool: asyncpg.Pool,
    *,
    reference_id: str,
    tcc_id: str,
) -> dict[str, str] | None:
    query = """
        SELECT id, title, abstract, "externalId" AS external_id, source
        FROM "Reference"
        WHERE id = $1 AND "tccId" = $2
    """
    row = await pool.fetchrow(query, reference_id, tcc_id)
    if row is None:
        return None
    return {
        "id": str(row["id"]),
        "title": str(row["title"]),
        "abstract": "" if row["abstract"] is None else str(row["abstract"]),
        "external_id": str(row["external_id"]),
        "source": str(row["source"]),
    }
