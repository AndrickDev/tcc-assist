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
