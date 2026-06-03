# Local smoke E2E — Phase 4 RAG

Roteiro pra validar o caminho completo localmente:
**ingestão (T-G3/T-G4) → retrieval (T-G5) → chat com citações (T-G6)**.

## Pré-requisitos

- Docker + docker-compose
- `uv` (ou `.venv` ativo)
- Node.js + `npx prisma` (para aplicar migrations Prisma)
- `psql` (para rodar o seed SQL)
- Variáveis de ambiente: `INTERNAL_JWT_SECRET`, `GOOGLE_API_KEY` (copia do `.env` ou Fly secrets)

## Setup uma vez

```bash
cd services/ai

# Sobe Postgres com pgvector + Redis
docker-compose up -d

# Aguarda healthy
docker-compose ps

# Aplica migrations Prisma (cria User/Tcc/Reference/Attachment/Message etc.)
cd ../../apps/web
DATABASE_URL=postgresql://tcc:tcc@localhost:5432/tcc npx prisma migrate deploy
cd -

# Aplica Alembic RAG schema (chunks/embeddings/ingestion_jobs + extensions)
POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc uv run alembic upgrade head

# Seed mínimo (User + Tcc + 2 References com abstracts)
psql postgresql://tcc:tcc@localhost:5432/tcc -f dev/seed_minimal.sql
```

## Rodar smoke

Em um terminal sobe o FastAPI:

```bash
cd services/ai
POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc \
REDIS_URL=redis://localhost:6379/0 \
INTERNAL_JWT_SECRET=$INTERNAL_JWT_SECRET \
GOOGLE_API_KEY=$GOOGLE_API_KEY \
uv run uvicorn app.main:app --reload
```

Em outro terminal roda o smoke:

```bash
cd services/ai
POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc \
REDIS_URL=redis://localhost:6379/0 \
INTERNAL_JWT_SECRET=$INTERNAL_JWT_SECRET \
GOOGLE_API_KEY=$GOOGLE_API_KEY \
uv run python dev/smoke_e2e.py
```

## O que o smoke faz

1. `GET /v1/health` → confirma FastAPI up.
2. `POST /v1/ingest/reference` com `smoke-ref-1` → 202 + `job_id`.
3. Polling em `GET /v1/ingest/{job_id}` até `status=done`.
4. `POST /v1/retrieve` com query relacionada → mostra top-k chunks + scores.
5. `POST /v1/chat` com pergunta sobre o conteúdo → imprime `agent_id`, `quota`, `citations` e preview do `content`.

Critério de sucesso:

- Ingestion termina em `done` com `chunk_count >= 1`.
- Retrieve retorna chunks com `score > 0.5`.
- Chat retorna `citations` não vazias com `n=1, 2, ...` e excerpt batendo com o abstract.

## Teardown

```bash
cd services/ai
docker-compose down       # mantém volume
docker-compose down -v    # wipa volume
```

## Troubleshooting

- `relation "Reference" does not exist`: faltou rodar `npx prisma migrate deploy`.
- `extension "vector" does not exist`: faltou `alembic upgrade head` (ou imagem Postgres errada — usar `pgvector/pgvector:pg16`).
- `EmbeddingUnavailable GOOGLE_API_KEY ausente`: env não exportado pro shell que roda o uvicorn.
- `429` no Google embed: free tier 1500 RPM bateu; aguarda 1min ou roda menos textos.
- Status `failed` no ingestion: ver log do uvicorn — campo `error` no GET status traz a primeira linha.
