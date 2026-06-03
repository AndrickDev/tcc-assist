```markdown
# T-G5 Retrieve endpoint (pgvector cosine top-k)

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg5-retrieve-endpoint`.
Phase 4 (RAG), quinta task. Liga o caminho query → embed → pgvector cosine → top-k chunks.
Sem mexer em ingestion, sem mexer em orchestrator de chat — T-G6 fará o hook do retrieve no
chat/generate.

ADRs:
- ADR-0001 — providers e RAG isolados em `services/ai`.
- ADR-0002 — pgvector cosine distance, IVFFlat `lists=100`, schema dim 768.
- ADR-0008 — provider Google `gemini-embedding-001` (vetores normalizados L2 client-side
  desde T-G2.1).

## Verified state — do not re-infer

- Tabelas RAG (migration 0001): `embeddings(chunk_id PK, model, dim, vector vector(768),
  created_at)`, `chunks(id PK, ingestion_job_id, tcc_id, source_type, source_ref, ordinal,
  content, token_count, metadata, created_at)`, `ingestion_jobs(id PK, tcc_id, source_type,
  source_ref, status, error, created_at, updated_at)`.
- Índice IVFFlat existente: `embeddings_vector_ivfflat USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100)`.
- Operador cosine pgvector: `<=>` (distance, menor = mais similar). `1 - (a <=> b)` =
  cosine similarity.
- Vetores no DB e do provider são normalizados L2 (T-G2.1) ⇒ `1 - distance` ∈ [0, 1]
  com 1 = match perfeito.
- `Reference` e `Attachment` não são consultados aqui — só `chunks` + `embeddings`.
- Auth scopes atuais: `Literal["chat", "generate", "action", "quota", "ingest"]`.
  `_SCOPES_WITH_TCC_ID = frozenset({"chat", "generate", "action", "ingest"})`.
- Provider via `get_embedding_provider()` retorna `EmbeddingProvider` com `.model`, `.dim`,
  `.embed(texts) -> EmbedResult`.
- Pool asyncpg em `app/db/pool.py::get_pool()`, dep `app/db/deps.py::get_pool_dep`.
- Redis dep em `app/api/quota.py::get_redis_dep` (confirmado no T-G3).
- Routers atuais registrados em `app/main.py`: chat, action, quota, ingest.
- Cache de embed (T-G2) é shared — query embeds cairão no mesmo namespace `embed:{model}:{sha256}`.
- `embedder.embed_texts(provider, redis, texts) -> list[list[float]]` é o entry point
  cache-aware. Já normaliza via provider; sem trabalho extra.

## Scope

### 1. Auth — adicionar scope `retrieve`

Em `services/ai/app/auth/jwt.py`:

```python
Scope: TypeAlias = Literal["chat", "generate", "action", "quota", "ingest", "retrieve"]
_SCOPES_WITH_TCC_ID: frozenset[Scope] = frozenset(
    {"chat", "generate", "action", "ingest", "retrieve"}
)
```

Atualizar `tests/auth/test_jwt.py` para cobrir scope `retrieve` (mesmo padrão de `ingest`).

### 2. Repository — `services/ai/app/rag/repository.py`

Adicionar uma única função:

```python
from typing import Sequence  # already imported


async def search_similar_chunks(
    pool: asyncpg.Pool,
    *,
    tcc_id: str,
    query_vector: Sequence[float],
    top_k: int,
    source_types: Sequence[str] | None = None,
) -> list[dict[str, object]]:
    """Top-k chunks by cosine similarity for the given tcc.

    Vetores armazenados são normalizados (T-G2.1), portanto
    1 - cosine_distance ∈ [0, 1], 1 = match perfeito.
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
```

`_format_vector` já existe no módulo (T-G3). Reusar.

### 3. New module `services/ai/app/api/retrieve.py`

```python
from __future__ import annotations

from typing import Annotated, Final

import asyncpg
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from redis.asyncio import Redis

from app.api.quota import get_redis_dep
from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.providers.embedding import EmbeddingProvider, get_embedding_provider
from app.rag import embedder, repository

log = structlog.get_logger(__name__)

DEFAULT_TOP_K: Final[int] = 8
MAX_TOP_K: Final[int] = 50
ALLOWED_SOURCE_TYPES: Final[frozenset[str]] = frozenset({"pdf", "openalex"})

router = APIRouter(prefix="/v1/retrieve", tags=["retrieve"])


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=DEFAULT_TOP_K, ge=1, le=MAX_TOP_K)
    source_types: list[str] | None = None


class RetrievedChunk(BaseModel):
    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    content: str
    metadata: dict[str, object]
    score: float


class RetrieveResponse(BaseModel):
    query: str
    model: str
    chunks: list[RetrievedChunk]


@router.post("", response_model=RetrieveResponse, status_code=status.HTTP_200_OK)
async def post_retrieve(
    body: RetrieveRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("retrieve"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    redis: Annotated[Redis, Depends(get_redis_dep)],
    provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> RetrieveResponse:
    if not claims.tcc_id:
        raise HTTPException(status_code=400, detail="tcc_id_missing")
    if body.source_types is not None:
        invalid = [t for t in body.source_types if t not in ALLOWED_SOURCE_TYPES]
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=f"invalid_source_types:{','.join(invalid)}",
            )

    vectors = await embedder.embed_texts(
        provider=provider, redis=redis, texts=[body.query]
    )
    if not vectors:
        return RetrieveResponse(query=body.query, model=provider.model, chunks=[])
    query_vector = vectors[0]

    rows = await repository.search_similar_chunks(
        pool,
        tcc_id=claims.tcc_id,
        query_vector=query_vector,
        top_k=body.top_k,
        source_types=body.source_types,
    )

    chunks = [
        RetrievedChunk(
            chunk_id=str(row["chunk_id"]),
            source_type=str(row["source_type"]),
            source_ref=str(row["source_ref"]),
            ordinal=int(row["ordinal"]),  # type: ignore[arg-type]
            content=str(row["content"]),
            metadata=row["metadata"] if isinstance(row["metadata"], dict) else {},
            score=float(row["score"]),  # type: ignore[arg-type]
        )
        for row in rows
    ]
    log.info(
        "retrieve_done",
        tcc_id=claims.tcc_id,
        top_k=body.top_k,
        n_results=len(chunks),
        source_types=body.source_types,
    )
    return RetrieveResponse(query=body.query, model=provider.model, chunks=chunks)
```

### 4. Register router em `services/ai/app/main.py`

Importar `retrieve_router` (ou seguir o padrão de nome) e chamar `app.include_router(...)`
ao lado dos demais. Manter ordem alfabética ou cronológica, conforme já usado no arquivo.

### 5. Tests novos

`services/ai/tests/rag/test_repository.py` (append, requires `TEST_POSTGRES_URL`):

- `test_search_similar_chunks_top_k_e_ordenacao`: seed de 5 chunks com vetores de mock
  (ex.: vetores em direções controladas, normalizados), executa `search_similar_chunks`
  com top_k=3. Verifica que retorna 3, ordenados por score desc, score ∈ (0, 1].
- `test_search_similar_chunks_filtra_por_source_type`: 3 PDFs + 3 openalex; busca
  `source_types=["pdf"]` → só PDFs retornam.
- `test_search_similar_chunks_isola_por_tcc`: chunks em tcc-A e tcc-B; busca em tcc-A não
  retorna chunks de tcc-B.
- `test_search_similar_chunks_sem_dados_retorna_vazio`: tcc sem chunks → `[]`.
- `test_search_similar_chunks_top_k_zero_ou_negativo_retorna_vazio`.

`services/ai/tests/api/test_retrieve_endpoint.py` (novo):

- `test_retrieve_happy_path`: monkeypatch `embedder.embed_texts` e
  `repository.search_similar_chunks` para vetor determinístico + 3 chunks fake. JWT scope
  `retrieve` válido + tcc_id. Asserta `response.status_code == 200`, `len(chunks) == 3`,
  ordem preservada, `model == provider.model`.
- `test_retrieve_query_vazia_retorna_422`: body `{"query": ""}` → 422.
- `test_retrieve_top_k_invalido_422`: `top_k=0` ou `top_k=99` → 422.
- `test_retrieve_source_types_invalido_422`: `source_types=["pdf","weird"]` → 422 com
  `invalid_source_types:weird` no detail.
- `test_retrieve_scope_errado_401`: JWT com scope=`chat` → 401 do `require_scope`.
- `test_retrieve_tcc_sem_chunks_retorna_vazio`: monkeypatch repo retorna `[]` → 200 com
  `chunks=[]`.
- `test_retrieve_cache_hit_embedder_nao_chama_provider`: pré-popular fakeredis com cache
  para o texto da query; spy no provider.embed; verifica `call_count == 0`.

`services/ai/tests/auth/test_jwt.py` (append):

- Caso novo cobrindo scope `retrieve` válido + tcc_id; e scope=`retrieve` sem `tcc_id` →
  `InvalidToken("missing_tcc_id")`.

### 6. README

Em `services/ai/README.md`, nova seção logo depois de "RAG ingestion":

```markdown
## RAG retrieval

Query top-k via `POST /v1/retrieve` com body `{"query": "...", "top_k": 8,
"source_types": ["pdf", "openalex"]}`. Auth JWT interno, `scope=retrieve` + `tcc_id`.
Embedding da query passa pelo mesmo cache Redis (T-G2). Busca usa pgvector com cosine
distance (operator `<=>`); score = `1 - distance` ∈ [0, 1] porque os vetores são
normalizados L2 client-side. `source_types` opcional filtra por origem (`pdf` ou
`openalex`). Sem `source_types`, busca em ambos.
```

## Closed decisions

- Default top_k = 8, max = 50. Limites em Pydantic Field.
- Score = `1 - cosine_distance`. ∈ [0, 1] dado L2 norm dos vetores.
- Sem threshold de score nesta task. Caller (T-G6) decide se filtra.
- Filtro `source_types` opcional. Se ausente → busca em ambos. Lista vazia trata como `None`
  no SQL (passar `None` para o parâmetro `$3` aciona `IS NULL`).
- Reuso de `embedder.embed_texts` para cache de query. Mesmo namespace `embed:{model}:...`
  que ingestion — propositalmente, hit cross.
- Resposta inclui `model` (qual provider gerou os embeddings consultados).
- Endpoint é POST (não GET) porque body tem query potencialmente longa + estruturada.
- Sem paginação (top_k já cobre janela inicial). Se T-G6 precisar de fan-out maior, ajusta lá.
- Sem rerank nesta task.

## Do not do

- Não chamar provider direto. Sempre via `embedder.embed_texts`.
- Não escrever no DB. Endpoint é puramente leitura.
- Não criar migration nova. Schema já está pronto.
- Não tocar em ingestion (`pdf_extract`, `chunker`, `ingest.run_*`, endpoints `/v1/ingest/*`).
- Não tocar `app/providers/embedding.py`.
- Não trocar operador pgvector — manter `<=>` (cosine).
- Não adicionar SDK pgvector pra asyncpg (codec custom); seguir padrão T-G3 com `::vector` cast.
- Não normalizar vetor da query no endpoint — provider já normaliza.
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `grep -q 'def search_similar_chunks' services/ai/app/rag/repository.py`
- `test -f services/ai/app/api/retrieve.py`
- `grep -q 'router = APIRouter(prefix="/v1/retrieve"' services/ai/app/api/retrieve.py`
- `grep -q '"retrieve"' services/ai/app/auth/jwt.py`
- `grep -q "ALLOWED_SOURCE_TYPES" services/ai/app/api/retrieve.py`
- `grep -q "MAX_TOP_K: Final\[int\] = 50" services/ai/app/api/retrieve.py`
- `grep -q 'RAG retrieval' services/ai/README.md`

Behavioral checks (cobertos pelos testes):

- Top-k respeitado: limite superior 50; default 8; >50 → 422.
- Ordering: score descendente.
- Tcc isolation: chunks de outro tcc nunca aparecem.
- source_types filter: aceita `["pdf"]`, `["openalex"]`, ou ambos; rejeita valores fora
  com 422.
- Empty input safeguards: tcc sem chunks → 200 com `chunks=[]`. Query vazia → 422.
- Scope errado → 401.
- Cache hit: embed da query não chama provider se já tem cache.

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

Expected: testes existentes seguem verdes (127 passed pós-T-G4). +10-13 novos testes
(7-9 endpoint + 2-4 repository com skip por TEST_POSTGRES_URL ausente + 1 auth). Total
esperado ~137-140 passed, skip count cresce 4-5 unidades por falta de `TEST_POSTGRES_URL`.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg5-retrieve-endpoint
```

Single commit:

```
feat(rag): retrieve endpoint POST /v1/retrieve (T-G5)

Recebe {query, top_k?, source_types?}, embeda query via embedder
(cache Redis namespaced), executa busca pgvector cosine
(operator <=>) em chunks/embeddings restrita ao tcc_id do JWT.
Retorna top_k chunks ordenados por score = 1 - distance.

Scope JWT retrieve adicionado a app/auth/jwt.py + _SCOPES_WITH_TCC_ID.
top_k default 8, max 50 (validado em Pydantic Field). source_types
opcional aceita pdf/openalex. Score ∈ [0, 1] porque vetores no DB
sao normalizados L2 (T-G2.1).

Endpoint e puramente leitura. Reusa embedder.embed_texts e o cache
de T-G2. Repository ganha search_similar_chunks (raw SQL com
::vector cast, sem codec custom).

Implementa ADR-0002 (cosine distance, IVFFlat) e ADR-0008 (provider).
```

Não push, não abrir PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Arquivos modificados/criados com line counts.
3. Output dos 4 gates.
4. Delta de testes (127 → ?). Quantos skipped a mais por TEST_POSTGRES_URL.
5. Sample structlog `retrieve_done` (tcc_id, top_k, n_results).
6. Sample payloads: 200 com 1 chunk + score; 422 invalid_source_types.
7. Quaisquer desvios com justificativa.
```
