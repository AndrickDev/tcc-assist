```markdown
# T-G3 PDF ingestion pipeline

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg3-pdf-ingestion`.
Phase 4 (RAG), third task. Implementa o caminho de ingestão de PDF: dado um `Attachment`
do usuário, baixa do Vercel Blob, extrai texto, chunka, embeda via `EmbeddingProvider` e
persiste em `chunks`/`embeddings`, atrelado a uma `ingestion_jobs` row. Não toca retrieval.

ADRs:
- ADR-0001 — providers e RAG isolados em `services/ai`.
- ADR-0002 (emendado) — schema RAG dim 768.
- ADR-0008 — provider Google `gemini-embedding-001` com MRL 768 + L2 norm (corrigido em T-G2.1).

## Verified state — do not re-infer

- `services/ai/app/rag/` contém: `__init__.py`, `embedding_cache.py`, `embedder.py`.
- `services/ai/app/db/` já tem pool asyncpg R/W em `pool.py::get_pool()` (rotulado "read-only"
  por convenção, mas é um pool padrão asyncpg). `tcc_repo.py` mostra o padrão de query
  (queries SQL inline em strings, args posicionais `$1, $2, ...`).
- Prisma usa identificadores em camelCase quoted: tabela `"Attachment"` com colunas
  `id`, `tccId`, `fileName`, `fileUrl`, `fileSize`, `mimeType`, `createdAt`.
- RAG tables em snake_case: `ingestion_jobs`, `chunks`, `embeddings` (ver migration 0001).
- `embeddings.vector` é `vector(768)`. asyncpg não tem codec nativo para pgvector — usar
  `pgvector.asyncpg.register_vector(connection)` por connection ao adquirir do pool,
  OU formatar como string `'[0.1, 0.2, ...]'::vector` no SQL.
- `app/providers/embedding.py::get_embedding_provider()` retorna `EmbeddingProvider` ativo.
- `app/rag/embedder.py::embed_texts(provider, redis, texts) -> list[list[float]]` faz
  cache-aware embed mantendo ordem.
- `app/auth/jwt.py` define `Scope = Literal["chat", "generate", "action", "quota"]` e
  `_SCOPES_WITH_TCC_ID = frozenset({"chat", "generate", "action"})`.
- `app/main.py` registra routers para chat, action, quota; e gerencia lifecycle do pool.
- httpx async já é padrão para HTTP externo.
- Testes usam `respx` para HTTP mock, `fakeredis.aioredis.FakeRedis` para Redis.
- DB tests precisam de `TEST_POSTGRES_URL` (existente em `.env.example`); skip se ausente.

Constraint operacional:

- Latência: provider Google leva ~200-400ms por embed call quente. Um PDF típico de TCC tem
  ~50-100 páginas, ~300-500 chunks. Com `GOOGLE_EMBED_CONCURRENCY=10` ⇒ ~50 rounds × 300ms
  ≈ 15-30s só de embed. Inviável manter a request HTTP aberta. Ingest precisa rodar como
  task em background com endpoint 202.

## Scope

### 1. Auth — adicionar scope `ingest`

Em `services/ai/app/auth/jwt.py`:

```python
Scope: TypeAlias = Literal["chat", "generate", "action", "quota", "ingest"]
_SCOPES_WITH_TCC_ID: frozenset[Scope] = frozenset({"chat", "generate", "action", "ingest"})
```

Atualizar testes existentes de auth se cobrirem o conjunto de scopes válidos.

No Next BFF (não nesta task, T-G3.x futuro): signer precisará emitir JWT com `scope=ingest`.

### 2. New module `services/ai/app/rag/pdf_extract.py`

Responsável por baixar o PDF do Vercel Blob (URL pública) e extrair texto por página.

```python
from __future__ import annotations

import io
from collections.abc import Sequence
from typing import Final

import httpx
import structlog
from pypdf import PdfReader

DEFAULT_TIMEOUT_S: Final[float] = 30.0
MAX_PDF_BYTES: Final[int] = 25 * 1024 * 1024  # 25 MB.

log = structlog.get_logger(__name__)


class PdfDownloadError(Exception):
    """Raised when the PDF cannot be downloaded."""


class PdfExtractError(Exception):
    """Raised when text extraction fails."""


async def fetch_pdf(url: str, *, client: httpx.AsyncClient | None = None) -> bytes:
    owns = client is None
    inner = client or httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S, follow_redirects=True)
    try:
        response = await inner.get(url)
    except httpx.RequestError as exc:
        raise PdfDownloadError(f"network: {exc}") from exc
    finally:
        if owns:
            await inner.aclose()

    if response.status_code != 200:
        raise PdfDownloadError(f"http_{response.status_code}")
    if len(response.content) > MAX_PDF_BYTES:
        raise PdfDownloadError(f"oversize: {len(response.content)} bytes")
    return response.content


def extract_pages(data: bytes) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(data))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text.strip())
        return pages
    except Exception as exc:  # pypdf raises a variety of exceptions
        raise PdfExtractError(str(exc)) from exc
```

### 3. New module `services/ai/app/rag/chunker.py`

Sliding window char-based. Aproximação suficiente para MVP (≈1 token ≈ 4 chars no PT-BR).

```python
from __future__ import annotations

from collections.abc import Iterable
from typing import Final

CHUNK_CHARS: Final[int] = 1500
CHUNK_OVERLAP_CHARS: Final[int] = 150
APPROX_CHARS_PER_TOKEN: Final[int] = 4


def chunk_text(text: str) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + CHUNK_CHARS, len(cleaned))
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start = end - CHUNK_OVERLAP_CHARS
    return chunks


def chunk_pages(pages: Iterable[str]) -> list[str]:
    joined = "\n\n".join(page for page in pages if page)
    return chunk_text(joined)


def approx_token_count(text: str) -> int:
    return max(1, len(text) // APPROX_CHARS_PER_TOKEN)
```

### 4. New module `services/ai/app/rag/repository.py`

Writes para `ingestion_jobs`, `chunks`, `embeddings`. Raw asyncpg para alinhar com
`tcc_repo.py`. Vector serializado como string `[0.1, 0.2, ...]` com cast `::vector`.

```python
from __future__ import annotations

from collections.abc import Sequence
from typing import Final, Literal
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
               (SELECT count(*) FROM chunks WHERE ingestion_job_id = ingestion_jobs.id) AS chunk_count
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
    async with pool.acquire() as conn:
        async with conn.transaction():
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
                    job_id, tcc_id, source_type, source_ref,
                    ordinal, content, tokens,
                )
                await conn.execute(
                    """
                    INSERT INTO embeddings (chunk_id, model, dim, vector)
                    VALUES ($1, $2, $3, $4::vector)
                    """,
                    chunk_row["id"], model, dim, _format_vector(vec),
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
    return {k: str(v) for k, v in dict(row).items()} if row else None
```

### 5. New module `services/ai/app/rag/ingest.py`

Orquestrador. Recebe job_id já criado em estado `pending`. Roda o pipeline e atualiza
status. Único entry point externo é `run_pdf_ingestion`.

```python
from __future__ import annotations

from collections.abc import Sequence
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

        vectors = await embedder.embed_texts(
            provider=provider, redis=redis, texts=chunks
        )
        token_counts = [chunker.approx_token_count(c) for c in chunks]
        inserted = await repository.insert_chunks_with_embeddings(
            pool,
            job_id=job_id,
            tcc_id=tcc_id,
            source_type="pdf",
            source_ref=str(job_id),  # PDFs use job_id as ref; OpenAlex will use externalId.
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
```

### 6. New module `services/ai/app/api/ingest.py`

Endpoints `POST /v1/ingest/pdf` e `GET /v1/ingest/{job_id}`. JWT scope `ingest`.

```python
from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.providers.embedding import EmbeddingProvider, get_embedding_provider
from app.quota.deps import get_redis_dep  # reuse the project's Redis dep.
from app.rag import ingest, repository
from redis.asyncio import Redis

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


class IngestPdfRequest(BaseModel):
    attachment_id: str


class IngestPdfResponse(BaseModel):
    job_id: str
    status: str


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
    response_model=IngestPdfResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def post_pdf(
    body: IngestPdfRequest,
    claims: InternalClaims = Depends(require_scope("ingest")),
    pool: asyncpg.Pool = Depends(get_pool_dep),
    redis: Redis = Depends(get_redis_dep),
    provider: EmbeddingProvider = Depends(get_embedding_provider),
) -> IngestPdfResponse:
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
    return IngestPdfResponse(job_id=str(job_id), status="pending")


@router.get("/{job_id}", response_model=IngestStatusResponse)
async def get_status(
    job_id: UUID,
    claims: InternalClaims = Depends(require_scope("ingest")),
    pool: asyncpg.Pool = Depends(get_pool_dep),
) -> IngestStatusResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    row = await repository.get_ingestion_job(
        pool, job_id=job_id, tcc_id=claims.tcc_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="job_not_found")
    return IngestStatusResponse(
        job_id=str(row["id"]),
        tcc_id=str(row["tcc_id"]),
        source_type=str(row["source_type"]),
        source_ref=str(row["source_ref"]),
        status=str(row["status"]),
        error=row.get("error"),  # type: ignore[arg-type]
        chunk_count=int(row["chunk_count"]),
    )
```

### 7. Register router em `services/ai/app/main.py`

Adicionar import e `app.include_router(ingest_router)` no mesmo ponto onde os outros
routers são registrados. Não mudar nada da inicialização do pool ou shutdown.

### 8. Update `services/ai/pyproject.toml`

Adicionar deps:

```toml
"pypdf>=4.0",
"pgvector>=0.3",  # already present from T-G1; ensure stays.
```

### 9. Tests

Estrutura paralela ao código:

- `tests/rag/test_pdf_extract.py`:
  - `fetch_pdf`: respx mocka 200 com bytes válidos, 404 → `PdfDownloadError`, 200 com >25MB
    payload → `PdfDownloadError oversize`.
  - `extract_pages`: usa um PDF fixture mínimo gerado inline (1-2 páginas com texto).
    Verifica `len(pages) == 2`, conteúdo presente. PDF corrompido → `PdfExtractError`.
- `tests/rag/test_chunker.py`:
  - Texto vazio → `[]`.
  - Texto curto (<CHUNK_CHARS) → 1 chunk único.
  - Texto longo: chunks com overlap correto entre consecutivos, último chunk pode ser menor.
  - `approx_token_count` retorna >= 1 mesmo para string vazia.
- `tests/rag/test_repository.py`:
  - Skip se `TEST_POSTGRES_URL` ausente (`pytest.skip`).
  - Round-trip: cria job, atualiza status, busca, finaliza.
  - `insert_chunks_with_embeddings`: cria job + 3 chunks + embeddings. Verifica
    `SELECT count(*) FROM chunks WHERE ingestion_job_id = $1 = 3` e
    `SELECT count(*) FROM embeddings = 3`.
  - Mismatch de tamanho entre chunks/vectors → `ValueError`.
  - `fetch_attachment_url` requer dado seedado; pular se DB sem dado de teste.
- `tests/rag/test_ingest.py`:
  - Mock `pdf_extract.fetch_pdf` e `pdf_extract.extract_pages` via monkeypatch.
  - Mock `embedder.embed_texts` para retornar vetores deterministicos.
  - Verifica que a `update_ingestion_status` é chamada em sequência: running → done.
  - Caminho de erro: `fetch_pdf` levanta → status terminam em `failed` com `error` setado.
- `tests/api/test_ingest_endpoint.py`:
  - JWT scope `ingest` válido + attachment presente → 202 + job_id UUID v4.
  - JWT scope errado → 403.
  - JWT sem `tcc_id` → 400.
  - Attachment não pertencente ao tcc → 404.
  - MIME != PDF → 415.
  - GET status retorna o estado salvo.

Mocks de pool/Redis seguem o padrão dos outros tests (fakeredis async + asyncpg fixture).

### 10. README snippet

Em `services/ai/README.md`, nova seção:

```markdown
## RAG ingestion

PDFs are ingested via `POST /v1/ingest/pdf` with body `{"attachment_id": "..."}`. Auth uses
the internal JWT with `scope=ingest` and the target `tcc_id`. Endpoint returns 202 + job_id;
work runs as a background task and the client polls `GET /v1/ingest/{job_id}` for status
(`pending` → `running` → `done`/`failed`). Chunks are 1500 chars (≈375 tokens) with 150
char overlap. Embeddings go through the configured `EmbeddingProvider` and are stored in
`chunks` + `embeddings` (RAG schema, ADR-0002).
```

## Closed decisions

- Extração: `pypdf` (lightweight, MVP). Não `unstructured` (pesado), não OCR (escaneados ficam fora).
- Chunking: char-based 1500/150 overlap. Tokenização aproximada (4 chars ≈ 1 token).
- Concorrência embed: reuso de `embedder.embed_texts` que delega ao provider (semáforo já
  configurado no provider).
- Persistência: raw asyncpg + transação por job. Vector serializado como string `[..]::vector`.
- Background task: `asyncio.create_task` direto dentro do request handler. Retorna 202.
- Status: polling via `GET`. Sem websocket, sem SSE para o MVP.
- Scope JWT: novo `ingest`. Adicionar ao `Scope` literal + `_SCOPES_WITH_TCC_ID`.
- Tamanho máximo PDF: 25 MB. Maior rejeita com `PdfDownloadError oversize` antes do extract.
- Source ref para PDF: `attachment_id` na `ingestion_jobs.source_ref`.
- Idempotência: nenhuma nesta task. Reupload do mesmo `attachment_id` cria nova job + chunks
  duplicados. Endurecer em T-G3.x se virar problema operacional.

## Do not do

- Não criar SQLAlchemy ORM models. Continuar com raw SQL via asyncpg.
- Não tocar `apps/web/prisma/schema.prisma` ou migrations Prisma.
- Não chamar `embedder.embed_texts` fora do background task — o endpoint precisa responder rápido.
- Não persistir bytes do PDF em lugar nenhum. Só texto extraído vira chunks.
- Não normalizar vetores no repository — provider já normaliza (ver T-G2.1).
- Não usar `BackgroundTasks` do FastAPI (rodam após response mas dentro do mesmo request
  scope; podem ser canceladas em shutdown). Usar `asyncio.create_task` puro.
- Não tentar implementar retry de jobs falhos. Status `failed` é terminal nesta task.
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `test -f services/ai/app/rag/pdf_extract.py`
- `test -f services/ai/app/rag/chunker.py`
- `test -f services/ai/app/rag/repository.py`
- `test -f services/ai/app/rag/ingest.py`
- `test -f services/ai/app/api/ingest.py`
- `grep -q '"pypdf>=4.0"' services/ai/pyproject.toml`
- `grep -q '"ingest"' services/ai/app/auth/jwt.py`
- `grep -q 'router = APIRouter(prefix="/v1/ingest"' services/ai/app/api/ingest.py`
- `grep -q 'include_router' services/ai/app/main.py` (já existia; ingest router agora também listado)
- `grep -q 'RAG ingestion' services/ai/README.md`

Behavioral checks (covered by tests):

- Chunker: overlap exato, ordinal sequencial, vazio → `[]`.
- PDF extract: PDF válido → list[str] não-vazia; corrompido → `PdfExtractError`.
- Repository: round-trip `create → update → get` com mudança de status. Insert de 3 chunks
  + 3 embeddings em uma transação.
- Ingest orchestrator: status flow `pending → running → done` no caminho feliz;
  `pending → running → failed` quando download/extract levanta.
- Endpoint POST: 202 + job_id em caminho feliz; 403/400/404/415 mapeados conforme escopo,
  tcc_id ausente, attachment ausente, MIME != PDF.
- Endpoint GET: 200 com status + chunk_count; 404 quando job_id não bate com tcc_id.

## Gates

`apps/web` não tocado. Skip.

`services/ai`:

```bash
cd services/ai
uv sync --extra dev
uv run ruff check .
uv run mypy app tests
uv run pytest -q
```

Expected: testes existentes seguem verdes; +N novos testes em `tests/rag/` e `tests/api/`.
Total esperado em torno de 120 passed (margem ±5). Sem regressão. Testes de `tests/rag/test_repository.py`
podem ser `skipped` se `TEST_POSTGRES_URL` não estiver no ambiente.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg3-pdf-ingestion
```

Single commit:

```
feat(rag): PDF ingestion pipeline (T-G3)

POST /v1/ingest/pdf recebe attachment_id, cria ingestion_jobs row,
dispara background task (asyncio.create_task) e retorna 202 com
job_id. GET /v1/ingest/{job_id} faz polling de status.

Pipeline: fetch_pdf (httpx, 25MB cap) -> extract_pages (pypdf) ->
chunk_pages (sliding window 1500/150 chars) -> embed_texts (cache
Redis + provider Google) -> insert_chunks_with_embeddings em
transacao asyncpg unica. Vector serializado como string ::vector
para evitar codec custom no pool.

JWT scope=ingest adicionado em app/auth/jwt.py. Pool asyncpg
preexistente reusado (sem nova conexao). Provider e Redis
injetados via Depends.

Reusa embedder.py e cache de T-G2. Implementa ADR-0002 (RAG
schema dim 768) e ADR-0008 (provider).
```

Não push, não abrir PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Arquivos modificados/criados com line counts.
3. Output dos 4 gates.
4. Delta de testes (100 → ?). Quantos skipped por falta de `TEST_POSTGRES_URL`.
5. Log structlog de uma execução de happy path (mock pipeline) — uma linha do tipo
   `ingest_pdf_done` com chunks + elapsed_ms.
6. Sample de payload retornado pelo endpoint POST e pelo GET.
7. Quaisquer desvios com justificativa.
```
