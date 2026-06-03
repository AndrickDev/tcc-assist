```markdown
# T-G4 OpenAlex abstract ingestion

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg4-openalex-ingestion`.
Phase 4 (RAG), quarta task. Reusa toda a infra de T-G2/T-G3 (provider, cache, embedder, repository,
ingest orchestrator pattern). A diferença é só a fonte: em vez de baixar PDF do Vercel Blob,
lê `Reference.abstract` (já populado pelo Next quando o usuário busca referências via
Semantic Scholar/OpenAlex).

ADRs:
- ADR-0001 — providers e RAG isolados em `services/ai`.
- ADR-0002 — schema RAG dim 768, `source_type IN ('pdf', 'openalex')` na CHECK constraint.
- ADR-0008 — provider Google `gemini-embedding-001` (atualizado em T-G2.1).

## Verified state — do not re-infer

Schema do produto (Prisma, `apps/web/prisma/schema.prisma`):

```
model Reference {
  id            String    @id @default(cuid())
  tccId         String
  externalId    String
  source        String    @default("semantic-scholar")
  title         String
  authors       String
  year          Int?
  abstract      String?
  ...
}
```

- `Reference.abstract` é nullable. Referências sem abstract não são ingeríveis (422).
- `Reference.source` upstream pode ser `semantic-scholar`, `openalex`, etc. Não confundir
  com `ingestion_jobs.source_type` (RAG-side), que é fixo em `'openalex'` para abstracts
  (per CHECK constraint da migration 0001) independente do provedor upstream.
- `Reference.tccId` é a chave de ownership (igual padrão do PDF via `Attachment.tccId`).

Infra existente que será reusada (NÃO refazer):

- `services/ai/app/rag/embedder.py::embed_texts(provider, redis, texts) -> list[list[float]]`.
- `services/ai/app/rag/chunker.py::chunk_pages` e `chunk_text`. Para abstracts curtos
  (<1500 chars), retorna lista de 1 elemento; sem mudança no comportamento.
- `services/ai/app/rag/repository.py`:
  - `create_ingestion_job(pool, tcc_id, source_type, source_ref) -> UUID`
  - `update_ingestion_status(pool, job_id, status, error)`
  - `get_ingestion_job(pool, job_id, tcc_id) -> dict | None`
  - `insert_chunks_with_embeddings(...)` — aceita `source_type` literal, então passa
    `"openalex"` direto.
- `services/ai/app/rag/ingest.py::run_pdf_ingestion` é o blueprint do orchestrator de
  ingestão. T-G4 adiciona `run_reference_ingestion` no mesmo módulo.
- `services/ai/app/api/ingest.py`: router prefix `/v1/ingest`, scope `ingest`, GET status
  `/v1/ingest/{job_id}` já existe. T-G4 adiciona POST `/v1/ingest/reference`.
- Auth: `Scope` literal já inclui `"ingest"` desde T-G3; `_SCOPES_WITH_TCC_ID` inclui
  `"ingest"`. Sem mudança em `app/auth/jwt.py`.

## Scope

### 1. Repository — `services/ai/app/rag/repository.py`

Adicionar uma única função para buscar a referência. Manter o padrão de raw SQL + quoted
Prisma identifiers já usado em `fetch_attachment_url`.

```python
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
```

### 2. Orchestrator — `services/ai/app/rag/ingest.py`

Adicionar `run_reference_ingestion` ao lado do `run_pdf_ingestion`. Mesma máquina de estado:
`pending → running → done|failed`.

```python
from app.rag import chunker, embedder, repository  # already imported
from uuid import UUID
import asyncpg
from redis.asyncio import Redis
from app.providers.embedding import EmbeddingProvider


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

        vectors = await embedder.embed_texts(
            provider=provider, redis=redis, texts=chunks
        )
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
```

### 3. Endpoint — `services/ai/app/api/ingest.py`

Adicionar POST `/v1/ingest/reference`. NÃO duplicar a rota GET de status — ela já cobre
qualquer `job_id` independente do `source_type`.

```python
class IngestReferenceRequest(BaseModel):
    reference_id: str


@router.post(
    "/reference",
    response_model=IngestPdfResponse,  # mesmo shape {job_id, status}
    status_code=status.HTTP_202_ACCEPTED,
)
async def post_reference(
    body: IngestReferenceRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("ingest"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> IngestPdfResponse:
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
    return IngestPdfResponse(job_id=str(job_id), status="pending")
```

Renomear `IngestPdfResponse` para `IngestJobResponse` (e re-exportar com alias se preferir
manter compatibilidade interna). Se renomear, ajustar imports/usos em `post_pdf` também.
Se preferir não tocar T-G3, manter o nome `IngestPdfResponse` reusado tal qual — fica
levemente incorreto semanticamente, mas é trade-off de churn. Recomendado: renomear para
`IngestJobResponse` em `app/api/ingest.py`, alias local em `post_pdf` para zero churn em
testes existentes.

### 4. Tests novos

`services/ai/tests/rag/test_repository.py` (append):

- `test_fetch_reference_for_ingest_round_trip`: requer `TEST_POSTGRES_URL`. Seed `"Reference"`
  + `"Tcc"` + `"User"` (mesmo padrão já usado em fixtures de repository). Verifica retorno.
- `test_fetch_reference_for_ingest_not_owned`: cria reference em outro tcc; busca com
  tcc_id diferente → `None`.
- `test_fetch_reference_for_ingest_null_abstract`: abstract null → dict com `abstract=""`.

`services/ai/tests/rag/test_ingest.py` (append):

- `test_run_reference_ingestion_happy_path`: monkeypatch `embedder.embed_texts` retornando
  vetor determinístico. Mock pool com fakes para `update_ingestion_status` e
  `insert_chunks_with_embeddings`. Verifica chamada de status running → done com `source_type='openalex'`.
- `test_run_reference_ingestion_empty_text`: title="" + abstract="" → status done sem
  chamada de embed.
- `test_run_reference_ingestion_embed_falha`: `embed_texts` levanta → status failed com
  `error` setado.

`services/ai/tests/api/test_ingest_endpoint.py` (append):

- `test_post_reference_202`: scope correto + reference com abstract → 202 + UUID job_id.
- `test_post_reference_404_quando_reference_nao_existe`.
- `test_post_reference_404_quando_tcc_diferente` (mock fetch retornando None).
- `test_post_reference_422_quando_abstract_null`.
- `test_post_reference_400_quando_tcc_id_ausente`.
- `test_post_reference_401_quando_scope_errado`.
- (status GET já coberto em T-G3; não duplicar)

`services/ai/tests/rag/test_chunker.py` não muda; comportamento já coberto.

### 5. README

Em `services/ai/README.md`, na seção "RAG ingestion" criada por T-G3, adicionar:

```markdown
References (abstracts) são ingeridas via `POST /v1/ingest/reference` com body
`{"reference_id": "..."}`. Mesma autenticação (JWT interno, `scope=ingest`, `tcc_id`
no claim). O serviço lê `Reference.title` + `Reference.abstract` do Postgres do produto,
concatena, chunka e embeda. Sem download HTTP. Polling de status segue o mesmo
`GET /v1/ingest/{job_id}`. `source_type` registrado em `ingestion_jobs` é `openalex`
para todos os abstracts, independente do `Reference.source` upstream.
```

## Closed decisions

- Source da ingestion: `Reference.title` + `Reference.abstract` concatenados com `\n\n`.
  Title agrega sinal semântico útil quando o abstract é curto.
- `source_type` literal no schema RAG: `'openalex'`. Não estender o CHECK constraint.
- `source_ref`: `Reference.id` (cuid string).
- Endpoint endpoint é POST `/v1/ingest/reference`, body `{reference_id}`. Sem variação
  bulk neste task — bulk vira T-G4.x se a UX precisar.
- Abstract null → 422 `reference_abstract_missing`. Não tenta ingerir só o title.
- Reuso de `IngestPdfResponse` shape (job_id, status) via rename para `IngestJobResponse`
  com alias local. Sem novo response model.
- Não modifica `app/auth/jwt.py` — scope `ingest` já existe.
- Não modifica migration. Schema RAG já comporta `openalex`.

## Do not do

- Não criar nova migration. Schema RAG já existe.
- Não estender CHECK constraint para outros source types.
- Não chamar API externa OpenAlex/Semantic Scholar daqui. Reference já está populada
  pelo Next BFF.
- Não duplicar GET de status. Reusa o existente.
- Não fazer fan-out automático "ingerir todas as references do tcc" nesta task. Single ref por chamada.
- Não inferir abstract a partir do title quando abstract null. Falha em 422.
- Não tocar em `app/rag/pdf_extract.py` nem `app/providers/`.
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `grep -q 'def fetch_reference_for_ingest' services/ai/app/rag/repository.py`
- `grep -q 'def run_reference_ingestion' services/ai/app/rag/ingest.py`
- `grep -q 'POST.*reference\|/reference' services/ai/app/api/ingest.py` (ou `@router.post("/reference"`)
- `grep -q 'class IngestReferenceRequest' services/ai/app/api/ingest.py`
- `grep -q "source_type=\"openalex\"" services/ai/app/rag/ingest.py`
- `grep -q "source_type=\"openalex\"" services/ai/app/api/ingest.py`
- `grep -q '/v1/ingest/reference' services/ai/README.md`

Behavioral checks (cobertos pelos testes):

- POST /v1/ingest/reference: 202 + job_id no caminho feliz.
- 404 quando reference não existe ou não pertence ao tcc do JWT.
- 422 quando reference.abstract é null/vazio.
- 401/400 mapeados igual ao PDF (scope inválido ou tcc_id missing).
- Repository round-trip lê reference por (id, tcc_id) com abstract preservado.
- Orchestrator: running → done no caminho feliz; running → failed com error truncado em erros.
- Orchestrator escreve `source_type='openalex'` em `ingestion_jobs` e em `chunks`.

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

Expected: testes existentes seguem verdes (120 passed pós-T-G3.1). +6-9 novos testes;
total esperado ~126-129 passed. Testes de `test_repository.py` que dependem de
`TEST_POSTGRES_URL` permanecem em skip se variável ausente.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg4-openalex-ingestion
```

Single commit:

```
feat(rag): OpenAlex abstract ingestion (T-G4)

POST /v1/ingest/reference recebe reference_id, le
Reference.title + Reference.abstract do Postgres (via SELECT
no schema do produto), chunka concatenacao, embeda via provider
Google + cache Redis, e persiste em chunks/embeddings com
source_type='openalex' e source_ref=reference_id.

Reusa toda a infra de T-G3: repository.create_ingestion_job,
update_ingestion_status, insert_chunks_with_embeddings, embedder,
chunker, scope JWT ingest. Mesma maquina de estado pending ->
running -> done|failed e GET /v1/ingest/{job_id} de status.

Abstract null retorna 422 reference_abstract_missing (nao tenta
inferir do title). Title vazio + abstract vazio retorna done sem
chunks.

Implementa ADR-0002 (source_type 'openalex' ja na CHECK constraint
da migration 0001) e ADR-0008 (provider Google).
```

Não push, não abrir PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Arquivos modificados/criados com line counts.
3. Output dos 4 gates.
4. Delta de testes (120 → ?).
5. Sample structlog `ingest_reference_done` em um teste mockado (chunks, elapsed_ms,
   reference_id).
6. Sample dos payloads de erro 422 e 404 com o detail.
7. Quaisquer desvios com justificativa.
```
