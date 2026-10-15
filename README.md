# Teseo

Plataforma de assistência à escrita de Trabalhos de Conclusão de Curso (TCC) com inteligência artificial, conforme normas ABNT.

## Visão geral

Teseo (anteriormente TCC-Assist) auxilia estudantes brasileiros na elaboração de TCCs com:

- Editor rico (Tiptap) com autosave e exportação PDF.
- Chat assistente que gera, revisa e refina conteúdo acadêmico, com RAG integrado: o chat recupera trechos das referências do usuário (pgvector) e responde com citações.
- Busca de referências reais via OpenAlex com filtros e citação ABNT.
- Limites diários por plano (FREE, PRO, VIP) com quota server-side em Redis.
- Pagamento dos planos PRO e VIP via Stripe Checkout, com webhook de assinatura verificada que atualiza o plano do usuário.

## Arquitetura

Monorepo com dois serviços que se comunicam via HTTP autenticado por JWT interno (HS256):

| Serviço | Diretório | Responsabilidade |
|---|---|---|
| Next.js | `apps/web` | UI, autenticação (NextAuth), Stripe, BFF, persistência via Prisma |
| FastAPI | `services/ai` | Orquestração de IA, prompts, providers (Gemini), quota Redis, pipeline RAG (ingestão, retrieval e citações no chat) |

Decisões arquiteturais documentadas em [`docs/adr/`](./docs/adr/):

- ADR-0001 — Separação do serviço de IA em FastAPI com RAG
- ADR-0002 — pgvector como vector store
- ADR-0003 — Gemini API como gerador (sem LLM local)
- ADR-0004 — Stripe `subscription` ao invés de `payment` (decidido; hoje o checkout ainda usa `payment`, ver Pendências conhecidas)
- ADR-0005 — Quota e rate limit em Redis
- ADR-0006 — JWT HS256 interno Next ↔ FastAPI
- ADR-0007 — Migração para monorepo

Status atual em [`STATUS.md`](./STATUS.md). Backlog em [`docs/BACKLOG.md`](./docs/BACKLOG.md).

## Pendências conhecidas

- Stripe: o checkout usa `mode: 'payment'` (pagamento único, plano válido por 12 meses). Migração para `subscription` recorrente e idempotência do webhook (ADR-0004) seguem no backlog.
- Rate limit por janela de tempo nas rotas de IA ainda não existe; hoje há apenas a cota diária por plano em Redis.
- Cut-over de `/api/gerar-tcc` para o FastAPI (`POST /v1/generate`) ainda não concluído (fase 5 do roadmap em `STATUS.md`).

## Stack

### Frontend (`apps/web`)
- Next.js 15 (App Router) · React 19
- Tailwind CSS · Framer Motion · Lucide
- Tiptap (editor)
- NextAuth v5 · Prisma · Stripe SDK
- jose (JWT signer interno)

### Serviço de IA (`services/ai`)
- Python 3.11 · FastAPI · Pydantic v2
- `uv` (gerenciador de dependências)
- `asyncpg` (Postgres read-only) · `redis` (asyncio)
- `httpx` (cliente Gemini) · `pyjwt`
- `structlog` · `ruff` · `mypy --strict` · `pytest`

### Infra
- PostgreSQL (Prisma owner) + pgvector (Alembic): embeddings de 768 dimensões, índice IVFFlat por cosseno
- Redis (quota diária por plano) — Upstash em produção
- CI no GitHub Actions (web e IA) e deploy do FastAPI no Fly.io
- Hospedagem: Vercel (Next) + Fly.io (FastAPI)

## Setup local

Pré-requisitos: Node 20+, Python 3.11, `uv`, Docker.

```bash
# 1. Subir Postgres + Redis
docker compose -f docker-compose.dev.yml up -d

# 2. Instalar dependências
cd apps/web && npm install && cd ../..
cd services/ai && uv sync && cd ../..

# 3. Configurar variáveis
cp apps/web/.env.example apps/web/.env.local      # editar e preencher
cp services/ai/.env.example services/ai/.env      # editar e preencher

# 4. Aplicar schema Prisma
cd apps/web && POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc?schema=public npx prisma db push

# 5. Subir os serviços (terminais separados)
cd services/ai && uv run uvicorn app.main:app --port 8000
cd apps/web && npm run dev
```

Smoke completo passo a passo em [`docs/dev-smoke.md`](./docs/dev-smoke.md).

## Scripts úteis

### `apps/web`
```bash
npm run dev         # servidor de desenvolvimento
npm run build       # build de produção
npm run lint        # ESLint
npm run typecheck   # TypeScript sem emit
```

### `services/ai`
```bash
uv run uvicorn app.main:app --reload    # dev server
uv run ruff check .                      # lint
uv run mypy .                            # type check (strict)
uv run pytest -q                         # testes
```

## Estrutura do repositório

```
tcc-assist/
├── apps/web/                  # Next.js (UI + BFF)
│   ├── src/app/               # rotas App Router
│   ├── src/lib/               # auth, prisma, ai-service, internal-jwt
│   └── prisma/                # schema + migrations
├── services/ai/               # FastAPI
│   ├── app/
│   │   ├── api/               # rotas HTTP (chat, generate, actions, ingest, retrieve, quota, health)
│   │   ├── auth/              # JWT verifier
│   │   ├── db/                # repositórios read-only
│   │   ├── orchestrator/      # workflows (chat, generate, action)
│   │   ├── prompts/           # templates versionados
│   │   ├── providers/         # Gemini (geração e embeddings)
│   │   ├── rag/               # ingestão, chunking, embeddings, retrieval
│   │   └── quota/             # Redis quota
│   └── tests/                 # mirror de app/
├── docs/
│   ├── adr/                   # decisões arquiteturais
│   ├── BACKLOG.md
│   └── dev-smoke.md
├── AGENTS.md                  # contexto operacional para agentes IA
├── STATUS.md                  # estado do roadmap
└── docker-compose.dev.yml     # Postgres + Redis para dev
```

## Documentação adicional

- [`AGENTS.md`](./AGENTS.md) e [`services/ai/AGENTS.md`](./services/ai/AGENTS.md) — convenções de código e contexto operacional
- [`STATUS.md`](./STATUS.md) — fase atual do roadmap, bugs conhecidos
- [`docs/BACKLOG.md`](./docs/BACKLOG.md) — fila de tarefas
- [`docs/dev-smoke.md`](./docs/dev-smoke.md) — validação local end-to-end

## Licença

Proprietário. Todos os direitos reservados.
