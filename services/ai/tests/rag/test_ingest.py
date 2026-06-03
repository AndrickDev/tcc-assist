from collections.abc import Sequence
from typing import cast
from uuid import UUID, uuid4

import asyncpg
import pytest
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import embedder, ingest, pdf_extract, repository


class FakeProvider:
    model = "test-model"
    dim = 3


async def test_run_pdf_ingestion_status_running_done(monkeypatch: pytest.MonkeyPatch) -> None:
    job_id = uuid4()
    statuses: list[tuple[repository.JobStatus, str | None]] = []
    inserted: dict[str, object] = {}

    async def update_status(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        status: repository.JobStatus,
        error: str | None = None,
    ) -> None:
        statuses.append((status, error))

    async def fetch_pdf(_url: str) -> bytes:
        return b"%PDF"

    def extract_pages(_data: bytes) -> list[str]:
        return ["pagina um", "pagina dois"]

    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]

    async def insert_chunks(pool: asyncpg.Pool, **kwargs: object) -> int:
        inserted.update(kwargs)
        return len(cast(Sequence[str], kwargs["chunks"]))

    monkeypatch.setattr(repository, "update_ingestion_status", update_status)
    monkeypatch.setattr(pdf_extract, "fetch_pdf", fetch_pdf)
    monkeypatch.setattr(pdf_extract, "extract_pages", extract_pages)
    monkeypatch.setattr("app.rag.embedder.embed_texts", embed_texts)
    monkeypatch.setattr(repository, "insert_chunks_with_embeddings", insert_chunks)

    await ingest.run_pdf_ingestion(
        pool=cast(asyncpg.Pool, object()),
        redis=cast(Redis, object()),
        provider=cast(EmbeddingProvider, FakeProvider()),
        job_id=job_id,
        tcc_id="tcc-1",
        file_url="https://example.com/file.pdf",
    )

    assert statuses == [("running", None), ("done", None)]
    assert inserted["job_id"] == job_id
    assert inserted["source_type"] == "pdf"


async def test_run_pdf_ingestion_falha_atualiza_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    job_id = uuid4()
    statuses: list[tuple[repository.JobStatus, str | None]] = []

    async def update_status(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        status: repository.JobStatus,
        error: str | None = None,
    ) -> None:
        statuses.append((status, error))

    async def fetch_pdf(_url: str) -> bytes:
        raise pdf_extract.PdfDownloadError("network: boom")

    monkeypatch.setattr(repository, "update_ingestion_status", update_status)
    monkeypatch.setattr(pdf_extract, "fetch_pdf", fetch_pdf)

    await ingest.run_pdf_ingestion(
        pool=cast(asyncpg.Pool, object()),
        redis=cast(Redis, object()),
        provider=cast(EmbeddingProvider, FakeProvider()),
        job_id=job_id,
        tcc_id="tcc-1",
        file_url="https://example.com/file.pdf",
    )

    assert statuses[0] == ("running", None)
    assert statuses[1][0] == "failed"
    assert statuses[1][1] == "network: boom"


async def test_run_reference_ingestion_happy_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = uuid4()
    statuses: list[tuple[repository.JobStatus, str | None]] = []
    inserted: dict[str, object] = {}

    async def update_status(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        status: repository.JobStatus,
        error: str | None = None,
    ) -> None:
        statuses.append((status, error))

    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _ in texts]

    async def insert_chunks(pool: asyncpg.Pool, **kwargs: object) -> int:
        inserted.update(kwargs)
        return len(cast(Sequence[str], kwargs["chunks"]))

    monkeypatch.setattr(repository, "update_ingestion_status", update_status)
    monkeypatch.setattr(embedder, "embed_texts", embed_texts)
    monkeypatch.setattr(repository, "insert_chunks_with_embeddings", insert_chunks)

    await ingest.run_reference_ingestion(
        pool=cast(asyncpg.Pool, object()),
        redis=cast(Redis, object()),
        provider=cast(EmbeddingProvider, FakeProvider()),
        job_id=job_id,
        tcc_id="tcc-1",
        reference_id="ref-1",
        title="Titulo",
        abstract="Resumo",
    )

    assert statuses == [("running", None), ("done", None)]
    assert inserted["job_id"] == job_id
    assert inserted["source_type"] == "openalex"
    assert inserted["source_ref"] == "ref-1"
    assert inserted["chunks"] == ["Titulo Resumo"]


async def test_run_reference_ingestion_empty_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = uuid4()
    statuses: list[tuple[repository.JobStatus, str | None]] = []
    embed_called = False

    async def update_status(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        status: repository.JobStatus,
        error: str | None = None,
    ) -> None:
        statuses.append((status, error))

    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        nonlocal embed_called
        embed_called = True
        return []

    monkeypatch.setattr(repository, "update_ingestion_status", update_status)
    monkeypatch.setattr(embedder, "embed_texts", embed_texts)

    await ingest.run_reference_ingestion(
        pool=cast(asyncpg.Pool, object()),
        redis=cast(Redis, object()),
        provider=cast(EmbeddingProvider, FakeProvider()),
        job_id=job_id,
        tcc_id="tcc-1",
        reference_id="ref-1",
        title="",
        abstract="",
    )

    assert statuses == [("running", None), ("done", None)]
    assert not embed_called


async def test_run_reference_ingestion_embed_falha(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job_id = uuid4()
    statuses: list[tuple[repository.JobStatus, str | None]] = []

    async def update_status(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        status: repository.JobStatus,
        error: str | None = None,
    ) -> None:
        statuses.append((status, error))

    async def embed_texts(
        *,
        provider: EmbeddingProvider,
        redis: Redis,
        texts: Sequence[str],
    ) -> list[list[float]]:
        raise RuntimeError("embed: boom")

    monkeypatch.setattr(repository, "update_ingestion_status", update_status)
    monkeypatch.setattr(embedder, "embed_texts", embed_texts)

    await ingest.run_reference_ingestion(
        pool=cast(asyncpg.Pool, object()),
        redis=cast(Redis, object()),
        provider=cast(EmbeddingProvider, FakeProvider()),
        job_id=job_id,
        tcc_id="tcc-1",
        reference_id="ref-1",
        title="Titulo",
        abstract="Resumo",
    )

    assert statuses[0] == ("running", None)
    assert statuses[1] == ("failed", "embed: boom")
