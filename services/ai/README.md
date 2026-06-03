# tcc-assist-ai

Servico FastAPI da camada de IA/RAG do Teseo / TCC-Assist.

## Desenvolvimento

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

Healthcheck:

```bash
curl http://localhost:8000/v1/health
```

Gates locais:

```bash
uv run ruff check .
uv run mypy .
uv run pytest -q
```

## Migrations (RAG schema)

Alembic owns the RAG tables (`chunks`, `embeddings`, `ingestion_jobs`). Prisma owns the product schema and is not touched by these migrations.

```bash
POSTGRES_URL=postgres://... uv run alembic upgrade head
POSTGRES_URL=postgres://... uv run alembic downgrade base
```

Requires `pgvector` available on the target Postgres instance. The migration enables the extension if absent.

## Embedding provider

Embeddings vao via `EmbeddingProvider` (Protocol em `app/providers/embedding.py`). Default:
Google `gemini-embedding-001` (dim 768) -- ver [ADR-0008](../../docs/adr/0008-embedding-provider-mvp.md).

Modelo: `gemini-embedding-001` (Google Generative AI). Dimensao reduzida via Matryoshka
Representation Learning (`outputDimensionality: 768`) -- o modelo nativamente produz 3072
floats e a API entrega o prefixo de 768 dimensoes. Vetores sao normalizados (L2) no cliente
antes de ir para cache/Postgres para o `vector_cosine_ops` operar corretamente.

Variaveis de ambiente:

- `EMBEDDING_PROVIDER` -- `google` (default).
- `GOOGLE_API_KEY` -- reuso da chave ja usada pelo provider Gemini.

Cache em Redis (`embed:{model}:{sha256(text)}`, TTL 30 dias) amortiza embeds repetidos durante
ingestao e retrieval. Trocar de provider invalida apenas a parte do namespace daquele modelo.

## Estrutura

```text
app/
├── api/
├── orchestrator/
├── rag/
├── providers/
├── prompts/
├── quota/
└── observability/
```
