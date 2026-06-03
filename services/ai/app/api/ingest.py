from __future__ import annotations

import asyncio
from typing import Annotated, cast
from uuid import UUID

import asyncpg
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.providers.embedding import EmbeddingProvider, get_embedding_provider
from app.rag import ingest, repository

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


class IngestPdfRequest(BaseModel):
    attachment_id: str


class IngestReferenceRequest(BaseModel):
    reference_id: str


class IngestJobResponse(BaseModel):
    job_id: str
    status: str


IngestPdfResponse = IngestJobResponse


class IngestStatusResponse(BaseModel):
    job_id: str
    tcc_id: str
    source_type: str
    source_ref: str
    status: str
    error: str | None
    chunk_count: int


@router.post(
    "/pdf",
    response_model=IngestJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def post_pdf(
    body: IngestPdfRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("ingest"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> IngestJobResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    attachment = await repository.fetch_attachment_url(
        pool, attachment_id=body.attachment_id, tcc_id=claims.tcc_id
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="attachment_not_found")
    if not attachment["mime_type"].startswith("application/pdf"):
        raise HTTPException(status_code=415, detail="unsupported_mime_type")

    job_id = await repository.create_ingestion_job(
        pool,
        tcc_id=claims.tcc_id,
        source_type="pdf",
        source_ref=body.attachment_id,
    )
    asyncio.create_task(
        ingest.run_pdf_ingestion(
            pool=pool,
            redis=redis,
            provider=provider,
            job_id=job_id,
            tcc_id=claims.tcc_id,
            file_url=attachment["file_url"],
        )
    )
    return IngestJobResponse(job_id=str(job_id), status="pending")


@router.post(
    "/reference",
    response_model=IngestJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def post_reference(
    body: IngestReferenceRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("ingest"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> IngestJobResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    reference = await repository.fetch_reference_for_ingest(
        pool, reference_id=body.reference_id, tcc_id=claims.tcc_id
    )
    if not reference:
        raise HTTPException(status_code=404, detail="reference_not_found")
    if not reference["abstract"]:
        raise HTTPException(status_code=422, detail="reference_abstract_missing")

    job_id = await repository.create_ingestion_job(
        pool,
        tcc_id=claims.tcc_id,
        source_type="openalex",
        source_ref=body.reference_id,
    )
    asyncio.create_task(
        ingest.run_reference_ingestion(
            pool=pool,
            redis=redis,
            provider=provider,
            job_id=job_id,
            tcc_id=claims.tcc_id,
            reference_id=body.reference_id,
            title=reference["title"],
            abstract=reference["abstract"],
        )
    )
    return IngestJobResponse(job_id=str(job_id), status="pending")


@router.get("/{job_id}", response_model=IngestStatusResponse)
async def get_status(
    job_id: UUID,
    claims: Annotated[InternalClaims, Depends(require_scope("ingest"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
) -> IngestStatusResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    row = await repository.get_ingestion_job(pool, job_id=job_id, tcc_id=claims.tcc_id)
    if not row:
        raise HTTPException(status_code=404, detail="job_not_found")
    return IngestStatusResponse(
        job_id=str(row["id"]),
        tcc_id=str(row["tcc_id"]),
        source_type=str(row["source_type"]),
        source_ref=str(row["source_ref"]),
        status=str(row["status"]),
        error=cast(str | None, row["error"]),
        chunk_count=int(cast(int, row["chunk_count"])),
    )
