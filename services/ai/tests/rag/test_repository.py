from typing import cast
from uuid import uuid4

import asyncpg
import pytest

from app.rag import repository


async def _ensure_rag_schema(pool: asyncpg.Pool) -> None:
    try:
        await pool.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await pool.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except asyncpg.PostgresError as exc:
        pytest.skip(f"pgvector unavailable: {exc}")

    await pool.execute(
        """
        CREATE TABLE IF NOT EXISTS ingestion_jobs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tcc_id text NOT NULL,
            source_type text NOT NULL,
            source_ref text NOT NULL,
            status text NOT NULL DEFAULT 'pending',
            error text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            ingestion_job_id uuid NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
            tcc_id text NOT NULL,
            source_type text NOT NULL,
            source_ref text NOT NULL,
            ordinal integer NOT NULL,
            content text NOT NULL,
            token_count integer NOT NULL,
            metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (ingestion_job_id, ordinal)
        );
        CREATE TABLE IF NOT EXISTS embeddings (
            chunk_id uuid PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
            model text NOT NULL,
            dim integer NOT NULL,
            vector vector(768) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS "Attachment" (
            id text PRIMARY KEY,
            "tccId" text NOT NULL,
            "fileName" text NOT NULL,
            "fileUrl" text NOT NULL,
            "fileSize" integer NOT NULL,
            "mimeType" text NOT NULL,
            "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        TRUNCATE embeddings, chunks, ingestion_jobs, "Attachment" RESTART IDENTITY CASCADE;
        """
    )


def _vector(cosine: float) -> list[float]:
    sine = (1.0 - cosine * cosine) ** 0.5
    return [cosine, sine, *([0.0] * 766)]


async def _seed_chunks(
    pool: asyncpg.Pool,
    *,
    tcc_id: str,
    source_type: repository.SourceType,
    source_ref: str,
    vectors: list[list[float]],
) -> None:
    job_id = await repository.create_ingestion_job(
        pool,
        tcc_id=tcc_id,
        source_type=source_type,
        source_ref=source_ref,
    )
    await repository.insert_chunks_with_embeddings(
        pool,
        job_id=job_id,
        tcc_id=tcc_id,
        source_type=source_type,
        source_ref=source_ref,
        chunks=[f"{source_type}-{index}" for index, _ in enumerate(vectors)],
        vectors=vectors,
        model="test-model",
        dim=768,
        token_counts=[1 for _ in vectors],
    )


async def test_ingestion_job_round_trip(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)

    job_id = await repository.create_ingestion_job(
        postgres_pool,
        tcc_id="tcc-1",
        source_type="pdf",
        source_ref="attachment-1",
    )
    await repository.update_ingestion_status(postgres_pool, job_id=job_id, status="running")
    row = await repository.get_ingestion_job(postgres_pool, job_id=job_id, tcc_id="tcc-1")
    await repository.update_ingestion_status(postgres_pool, job_id=job_id, status="done")
    done = await repository.get_ingestion_job(postgres_pool, job_id=job_id, tcc_id="tcc-1")

    assert row is not None
    assert row["status"] == "running"
    assert row["chunk_count"] == 0
    assert done is not None
    assert done["status"] == "done"


async def test_insert_chunks_with_embeddings(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)
    job_id = await repository.create_ingestion_job(
        postgres_pool,
        tcc_id="tcc-1",
        source_type="pdf",
        source_ref="attachment-1",
    )
    vectors = [[0.1] * 768, [0.2] * 768, [0.3] * 768]

    inserted = await repository.insert_chunks_with_embeddings(
        postgres_pool,
        job_id=job_id,
        tcc_id="tcc-1",
        source_type="pdf",
        source_ref="attachment-1",
        chunks=["um", "dois", "tres"],
        vectors=vectors,
        model="test-model",
        dim=768,
        token_counts=[1, 1, 1],
    )
    chunk_count = await postgres_pool.fetchval(
        "SELECT count(*) FROM chunks WHERE ingestion_job_id = $1",
        job_id,
    )
    embedding_count = await postgres_pool.fetchval("SELECT count(*) FROM embeddings")

    assert inserted == 3
    assert chunk_count == 3
    assert embedding_count == 3


async def test_insert_chunks_with_embeddings_mismatch_levanta_value_error(
    postgres_pool: asyncpg.Pool,
) -> None:
    await _ensure_rag_schema(postgres_pool)

    with pytest.raises(ValueError):
        await repository.insert_chunks_with_embeddings(
            postgres_pool,
            job_id=uuid4(),
            tcc_id="tcc-1",
            source_type="pdf",
            source_ref="attachment-1",
            chunks=["um"],
            vectors=[],
            model="test-model",
            dim=768,
            token_counts=[1],
        )


async def test_fetch_attachment_url_filtra_por_tcc(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)
    await postgres_pool.execute(
        """
        INSERT INTO "Attachment" (
            id, "tccId", "fileName", "fileUrl", "fileSize", "mimeType"
        )
        VALUES ('att-1', 'tcc-1', 'arquivo.pdf', 'https://blob/file.pdf', 10, 'application/pdf')
        """
    )

    row = await repository.fetch_attachment_url(
        postgres_pool,
        attachment_id="att-1",
        tcc_id="tcc-1",
    )
    missing = await repository.fetch_attachment_url(
        postgres_pool,
        attachment_id="att-1",
        tcc_id="tcc-2",
    )

    assert row == {
        "id": "att-1",
        "file_url": "https://blob/file.pdf",
        "file_name": "arquivo.pdf",
        "mime_type": "application/pdf",
    }
    assert missing is None


async def test_fetch_reference_for_ingest_round_trip(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)

    row = await repository.fetch_reference_for_ingest(
        postgres_pool,
        reference_id="ref-1",
        tcc_id="tcc-1",
    )

    assert row == {
        "id": "ref-1",
        "title": "Ref baixa",
        "abstract": "Resumo baixo",
        "external_id": "ext-1",
        "source": "semantic-scholar",
    }


async def test_fetch_reference_for_ingest_not_owned(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)

    row = await repository.fetch_reference_for_ingest(
        postgres_pool,
        reference_id="ref-1",
        tcc_id="tcc-empty",
    )

    assert row is None


async def test_fetch_reference_for_ingest_null_abstract(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)

    row = await repository.fetch_reference_for_ingest(
        postgres_pool,
        reference_id="ref-4",
        tcc_id="tcc-1",
    )

    assert row is not None
    assert row["abstract"] == ""


async def test_search_similar_chunks_top_k_e_ordenacao(
    postgres_pool: asyncpg.Pool,
) -> None:
    await _ensure_rag_schema(postgres_pool)
    await _seed_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        source_type="pdf",
        source_ref="att-1",
        vectors=[_vector(0.95), _vector(0.80), _vector(0.60), _vector(0.40), _vector(0.20)],
    )

    rows = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        query_vector=_vector(1.0),
        top_k=3,
    )
    scores = [float(cast(float, row["score"])) for row in rows]

    assert len(rows) == 3
    assert scores == sorted(scores, reverse=True)
    assert all(0.0 < score <= 1.0 for score in scores)


async def test_search_similar_chunks_filtra_por_source_type(
    postgres_pool: asyncpg.Pool,
) -> None:
    await _ensure_rag_schema(postgres_pool)
    await _seed_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        source_type="pdf",
        source_ref="att-1",
        vectors=[_vector(0.95), _vector(0.85), _vector(0.75)],
    )
    await _seed_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        source_type="openalex",
        source_ref="ref-1",
        vectors=[_vector(0.99), _vector(0.98), _vector(0.97)],
    )

    rows = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        query_vector=_vector(1.0),
        top_k=6,
        source_types=["pdf"],
    )

    assert len(rows) == 3
    assert {row["source_type"] for row in rows} == {"pdf"}


async def test_search_similar_chunks_isola_por_tcc(postgres_pool: asyncpg.Pool) -> None:
    await _ensure_rag_schema(postgres_pool)
    await _seed_chunks(
        postgres_pool,
        tcc_id="tcc-A",
        source_type="pdf",
        source_ref="att-A",
        vectors=[_vector(0.80), _vector(0.70)],
    )
    await _seed_chunks(
        postgres_pool,
        tcc_id="tcc-B",
        source_type="pdf",
        source_ref="att-B",
        vectors=[_vector(0.99), _vector(0.98)],
    )

    rows = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-A",
        query_vector=_vector(1.0),
        top_k=4,
    )

    assert len(rows) == 2
    assert {row["tcc_id"] for row in rows} == {"tcc-A"}


async def test_search_similar_chunks_sem_dados_retorna_vazio(
    postgres_pool: asyncpg.Pool,
) -> None:
    await _ensure_rag_schema(postgres_pool)

    rows = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-empty",
        query_vector=_vector(1.0),
        top_k=3,
    )

    assert rows == []


async def test_search_similar_chunks_top_k_zero_ou_negativo_retorna_vazio(
    postgres_pool: asyncpg.Pool,
) -> None:
    await _ensure_rag_schema(postgres_pool)

    zero = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        query_vector=_vector(1.0),
        top_k=0,
    )
    negative = await repository.search_similar_chunks(
        postgres_pool,
        tcc_id="tcc-1",
        query_vector=_vector(1.0),
        top_k=-1,
    )

    assert zero == []
    assert negative == []
