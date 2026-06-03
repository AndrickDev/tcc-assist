from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

import asyncpg
import jwt
import pytest
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.db.deps import get_pool_dep
from app.main import create_app
from app.providers.embedding import EmbeddingProvider, get_embedding_provider
from app.rag import ingest, repository

SECRET = "test-secret-with-at-least-32-bytes"


class FakeProvider:
    model = "test-model"
    dim = 768


def _timestamp(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp())


def _make_token(*, scope: str = "ingest", tcc_id: str | None = "tcc-1") -> str:
    claims: dict[str, object] = {
        "sub": "user-1",
        "plan": "PRO",
        "scope": scope,
        "iat": _timestamp(timedelta(minutes=-1)),
        "exp": _timestamp(timedelta(minutes=5)),
        "iss": "tcc-assist-web",
        "aud": "tcc-assist-ai",
    }
    if tcc_id is not None:
        claims["tccId"] = tcc_id
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_pool_dep] = lambda: cast(asyncpg.Pool, object())
    app.dependency_overrides[get_redis_dep] = lambda: cast(Redis, object())
    app.dependency_overrides[get_embedding_provider] = lambda: cast(
        EmbeddingProvider, FakeProvider()
    )
    return TestClient(app)


def test_post_pdf_happy_202(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    job_id = uuid4()
    started: dict[str, object] = {}

    async def fetch_attachment_url(
        pool: asyncpg.Pool,
        *,
        attachment_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return {
            "id": attachment_id,
            "file_url": "https://blob/file.pdf",
            "file_name": "file.pdf",
            "mime_type": "application/pdf",
        }

    async def create_ingestion_job(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        source_type: repository.SourceType,
        source_ref: str,
    ) -> UUID:
        assert source_ref == "att-1"
        return job_id

    async def run_pdf_ingestion(**kwargs: object) -> None:
        started.update(kwargs)

    monkeypatch.setattr(repository, "fetch_attachment_url", fetch_attachment_url)
    monkeypatch.setattr(repository, "create_ingestion_job", create_ingestion_job)
    monkeypatch.setattr(ingest, "run_pdf_ingestion", run_pdf_ingestion)

    response = _client().post(
        "/v1/ingest/pdf",
        json={"attachment_id": "att-1"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 202
    assert response.json() == {"job_id": str(job_id), "status": "pending"}


def test_post_pdf_scope_errado_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/ingest/pdf",
        json={"attachment_id": "att-1"},
        headers={"Authorization": f"Bearer {_make_token(scope='chat')}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_post_pdf_sem_tcc_id_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/ingest/pdf",
        json={"attachment_id": "att-1"},
        headers={"Authorization": f"Bearer {_make_token(tcc_id=None)}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "missing_tcc_id"}


def test_post_pdf_attachment_ausente_retorna_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fetch_attachment_url(
        pool: asyncpg.Pool,
        *,
        attachment_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return None

    monkeypatch.setattr(repository, "fetch_attachment_url", fetch_attachment_url)

    response = _client().post(
        "/v1/ingest/pdf",
        json={"attachment_id": "att-1"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "attachment_not_found"}


def test_post_pdf_mime_nao_pdf_retorna_415(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fetch_attachment_url(
        pool: asyncpg.Pool,
        *,
        attachment_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return {
            "id": attachment_id,
            "file_url": "https://blob/file.txt",
            "file_name": "file.txt",
            "mime_type": "text/plain",
        }

    monkeypatch.setattr(repository, "fetch_attachment_url", fetch_attachment_url)

    response = _client().post(
        "/v1/ingest/pdf",
        json={"attachment_id": "att-1"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 415
    assert response.json() == {"detail": "unsupported_mime_type"}


def test_post_reference_202(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    job_id = uuid4()

    async def fetch_reference_for_ingest(
        pool: asyncpg.Pool,
        *,
        reference_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return {
            "id": reference_id,
            "title": "Titulo",
            "abstract": "Resumo",
            "external_id": "W123",
            "source": "openalex",
        }

    async def create_ingestion_job(
        pool: asyncpg.Pool,
        *,
        tcc_id: str,
        source_type: repository.SourceType,
        source_ref: str,
    ) -> UUID:
        assert tcc_id == "tcc-1"
        assert source_type == "openalex"
        assert source_ref == "ref-1"
        return job_id

    async def run_reference_ingestion(**kwargs: object) -> None:
        return None

    monkeypatch.setattr(repository, "fetch_reference_for_ingest", fetch_reference_for_ingest)
    monkeypatch.setattr(repository, "create_ingestion_job", create_ingestion_job)
    monkeypatch.setattr(ingest, "run_reference_ingestion", run_reference_ingestion)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-1"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 202
    assert response.json() == {"job_id": str(job_id), "status": "pending"}


def test_post_reference_404_quando_reference_nao_existe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fetch_reference_for_ingest(
        pool: asyncpg.Pool,
        *,
        reference_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return None

    monkeypatch.setattr(repository, "fetch_reference_for_ingest", fetch_reference_for_ingest)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-missing"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "reference_not_found"}


def test_post_reference_404_quando_tcc_diferente(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fetch_reference_for_ingest(
        pool: asyncpg.Pool,
        *,
        reference_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        assert tcc_id == "tcc-2"
        return None

    monkeypatch.setattr(repository, "fetch_reference_for_ingest", fetch_reference_for_ingest)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-1"},
        headers={"Authorization": f"Bearer {_make_token(tcc_id='tcc-2')}"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "reference_not_found"}


def test_post_reference_422_quando_abstract_null(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def fetch_reference_for_ingest(
        pool: asyncpg.Pool,
        *,
        reference_id: str,
        tcc_id: str,
    ) -> dict[str, str] | None:
        return {
            "id": reference_id,
            "title": "Titulo",
            "abstract": "",
            "external_id": "W123",
            "source": "openalex",
        }

    monkeypatch.setattr(repository, "fetch_reference_for_ingest", fetch_reference_for_ingest)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-1"},
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "reference_abstract_missing"}


def test_post_reference_sem_tcc_id_retorna_401(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-1"},
        headers={"Authorization": f"Bearer {_make_token(tcc_id=None)}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "missing_tcc_id"}


def test_post_reference_401_quando_scope_errado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    response = _client().post(
        "/v1/ingest/reference",
        json={"reference_id": "ref-1"},
        headers={"Authorization": f"Bearer {_make_token(scope='chat')}"},
    )

    assert response.status_code == 401
    assert response.json() == {"error": "invalid_token", "detail": "scope_mismatch"}


def test_get_status_happy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)
    job_id = uuid4()

    async def get_ingestion_job(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        tcc_id: str,
    ) -> dict[str, object] | None:
        return {
            "id": job_id,
            "tcc_id": tcc_id,
            "source_type": "pdf",
            "source_ref": "att-1",
            "status": "done",
            "error": None,
            "chunk_count": 3,
        }

    monkeypatch.setattr(repository, "get_ingestion_job", get_ingestion_job)

    response = _client().get(
        f"/v1/ingest/{job_id}",
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "job_id": str(job_id),
        "tcc_id": "tcc-1",
        "source_type": "pdf",
        "source_ref": "att-1",
        "status": "done",
        "error": None,
        "chunk_count": 3,
    }


def test_get_status_404_quando_job_nao_bate_tcc(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_JWT_SECRET", SECRET)

    async def get_ingestion_job(
        pool: asyncpg.Pool,
        *,
        job_id: UUID,
        tcc_id: str,
    ) -> dict[str, object] | None:
        return None

    monkeypatch.setattr(repository, "get_ingestion_job", get_ingestion_job)

    response = _client().get(
        f"/v1/ingest/{uuid4()}",
        headers={"Authorization": f"Bearer {_make_token()}"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "job_not_found"}
