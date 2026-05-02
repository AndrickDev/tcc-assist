# AGENTS.md — Teseo / TCC-Assist (monorepo)

> Fonte de verdade operacional pro Codex CLI e qualquer agente IA.
> Carregado automaticamente em toda sessão. Curto e atual.
> Última atualização: 2026-05-02

---

## 1. Produto

**Teseo (TCC-Assist)** é um SaaS BR que ajuda alunos a escreverem TCC com IA:
geração de capítulos, citações ABNT, busca de referências reais (OpenAlex),
revisão e exportação PDF. Planos FREE / PRO / VIP via Stripe.

**Estado:** beta controlado, 1 dev solo, sem usuários pagantes ainda.
Pode-se quebrar schema/API sem migration backward-compat.

---

## 2. Layout monorepo

Este repositório contém **dois serviços** que rodam independentemente em produção:

```
tcc-assist/
├── apps/
│   └── web/                  Next.js (Vercel) — UI + auth + Stripe + BFF
├── services/
│   └── ai/                   FastAPI (host TBD — BL-007) — IA, RAG, quota
├── docs/                     Cross-cutting: ADRs, BACKLOG, runbooks
├── AGENTS.md                 (este arquivo, raiz)
├── STATUS.md
├── README.md
└── .github/workflows/
    ├── ci-web.yml            paths: apps/web/** → typecheck + lint
    └── ci-ai.yml             paths: services/ai/** → ruff + mypy + pytest
```

Decisão de monorepo formalizada na **ADR-0007**. Runtime split mantido conforme **ADR-0001**.

### Operação por workspace

| Workspace | Linguagem | Comandos rodam de... |
|---|---|---|
| `apps/web` | Node 20 / TS 5 / Next 15 | `cd apps/web && npm run <script>` |
| `services/ai` | Python 3.11 / uv | `cd services/ai && uv run <comando>` |

Raiz **não** tem `package.json` nem `pyproject.toml`. Não use `npm` nem `uv` da raiz.

---

## 3. Stack — atual e alvo

| Camada | Hoje | Alvo |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, Tiptap, Tailwind v4 | Mesmo |
| BFF / Auth / Stripe | Next.js API routes, NextAuth v5 beta, Prisma 5 | Mesmo |
| **IA / RAG** | `callGemini` direto no Next + prompts hardcoded | **FastAPI** + RAG sobre pgvector + Gemini Flash via API |
| DB | Postgres (env `POSTGRES_URL`) | + extensão `pgvector` |
| Quota / rate limit | `localStorage` (bypass trivial) | Redis (Upstash) |
| Pagamento | Stripe `mode:'payment'` | Stripe `mode:'subscription'` |
| Storage | Vercel Blob | Mesmo |
| Embeddings | — | `BAAI/bge-m3` local no FastAPI |

---

## 4. Decisões arquiteturais já tomadas (NÃO rediscuta — execute)

- **ADR-0001** — IA roda em FastAPI separado. Next vira BFF.
- **ADR-0002** — Vector store é `pgvector` no Postgres existente.
- **ADR-0003** — LLM gerador é Gemini Flash via API. Local só p/ embeddings (`bge-m3`).
- **ADR-0004** (BL-003 pendente) — Stripe migra pra `mode:'subscription'`.
- **ADR-0005** (BL-004 pendente) — Quota e rate limit em Redis.
- **ADR-0006** (BL-005 pendente) — Comunicação Next ↔ FastAPI por JWT interno.
- **ADR-0007** — Monorepo com runtime split.

Se um ADR ainda não tem arquivo em `docs/adr/`, **crie antes de codar** a tarefa relacionada.

---

## 5. Repo map detalhado

```
apps/web/
├── src/
│   ├── app/
│   │   ├── api/                       rotas API
│   │   │   ├── chat/route.ts          orquestrador IA (vai virar proxy p/ FastAPI)
│   │   │   ├── gerar-tcc/route.ts     geração de capítulo (idem)
│   │   │   ├── tcc/[id]/
│   │   │   │   ├── route.ts           CRUD do TCC
│   │   │   │   ├── ai-action/         revisar/abnt/citações/próximo-passo
│   │   │   │   ├── messages/
│   │   │   │   ├── references/
│   │   │   │   ├── attachments/
│   │   │   │   └── stats/             HOJE FAKE (B6)
│   │   │   ├── stripe/                checkout + webhook
│   │   │   └── admin/
│   │   ├── tcc/[id]/page.tsx          workspace (1144 linhas — quebrar em BL-101)
│   │   └── dashboard/page.tsx
│   └── lib/
│       ├── auth.ts                    NextAuth Node (Prisma)
│       ├── auth.config.ts             NextAuth edge (sem Prisma)
│       ├── plan.ts                    FONTE ÚNICA de limites por plano
│       ├── prisma.ts
│       ├── stripe.ts
│       ├── gemini.ts                  callGemini (sumirá)
│       ├── ai/provider.ts             abstração (sumirá)
│       ├── agents/aiox-integration.ts orquestrador (vai virar serviço FastAPI)
│       ├── agents/guardrails.ts       prompts por ação (portar p/ Python)
│       ├── papers-search.ts           OpenAlex client (MANTER)
│       └── references.ts              formatação ABNT (MANTER)
├── prisma/
│   └── schema.prisma                  User, Tcc, Message, Reference, Attachment
├── package.json
├── next.config.ts
└── tsconfig.json

services/ai/
├── app/
│   ├── api/                           rotas FastAPI
│   │   └── health.py                  GET /v1/health (atual)
│   ├── orchestrator/                  workflows (chat, generate, action) — futuro
│   ├── rag/                           chunker, retriever, reranker — futuro
│   ├── providers/                     gemini, embeddings, openalex — futuro
│   ├── prompts/                       templates Python (não .md) — futuro
│   ├── quota/                         Redis-backed — futuro
│   └── observability/
│       └── logging.py                 structlog setup
├── tests/
├── pyproject.toml                     ruff + mypy strict + pytest
├── Dockerfile                         uv sync --frozen --no-dev
└── AGENTS.md                          regras Python específicas

docs/
├── adr/                               000X-*.md, decisões arquiteturais
├── BACKLOG.md                         tarefas (BL-NNN) e itens descartados
├── features/                          spec end-to-end por feature (criar conforme avança)
└── runbooks/                          incident response (criar conforme avança)
```

---

## 6. Regras duras (não negociáveis)

### Segurança
- **Toda rota** que recebe `tccId` faz `prisma.tcc.findFirst({ where: { id, userId } })` antes de qualquer leitura/mutação.
- **Nunca** confie em `session.user.role` sem chamar `auth()` no servidor.
- **Não** adicione env em `next.config.ts > env: {}` — qualquer var listada lá vaza pro bundle do client. Use `process.env.X` direto em código server.
- CORS restrito a `process.env.NEXT_PUBLIC_APP_URL`. **Não** use `*` com `Allow-Credentials: true`.
- Webhooks externos (Stripe etc.) precisam de **assinatura validada + idempotência** (tabela `processed_events`).

### Tipos / qualidade

| Workspace | Comando obrigatório (precisa passar com 0 erros) |
|---|---|
| `apps/web` | `npm run typecheck` e `npm run lint` |
| `services/ai` | `uv run ruff check .`, `uv run mypy .` (strict), `uv run pytest -q` |

- **Não** silencie com `as any`, `@ts-expect-error`, `# type: ignore`, `// eslint-disable-*` sem causa real. Justifique em 1 linha quando inevitável (ex: lib externa sem types).

### Banco
- Mudou `apps/web/prisma/schema.prisma` → `cd apps/web && npx prisma migrate dev --name <descritivo>` na mesma tarefa.
- Não use `prisma db push` em código que vai pra main.
- Coluna usada em `where` de query quente → adicione `@@index`.
- Schema dual-managed: Prisma é dono do schema produto; Alembic (em `services/ai/`, futuro) é dono do schema RAG. Sem sobreposição.

### Escopo
- Execute **apenas** o pedido. Sem refator lateral.
- Bug fora do escopo? **Anota em `docs/BACKLOG.md`**, não corrige no PR atual.

---

## 7. Bugs conhecidos — NÃO regrida

| ID | Descrição | Local |
|---|---|---|
| B1 | CORS `*` + `Allow-Credentials: true` | `apps/web/next.config.ts:9-21` |
| B2 | `GOOGLE_API_KEY` exposto em `env: {}` | `apps/web/next.config.ts:6-8` |
| B3 | Limite diário em `localStorage` (bypass) | `apps/web/src/app/tcc/[id]/page.tsx:68` |
| B4 | `/api/chat`, `/api/gerar-tcc`, `/api/tcc/[id]/ai-action` sem rate limit | `apps/web/src/app/api/*` |
| B5 | Webhook Stripe sem idempotência | `apps/web/src/app/api/stripe/webhook/route.ts` |
| B6 | `stats/route.ts` calcula progresso/plágio com regex em texto livre (fake) | `apps/web/src/app/api/tcc/[id]/stats/route.ts` |
| B7 | Type errors: `EventName` faltando, `messageId` em `never` | `apps/web/src/app/tcc/[id]/page.tsx:552,559,759,763,765` |
| B8 | Roles checados via `@ts-expect-error` em rotas admin | `apps/web/src/app/api/admin/**` |
| B9 | `aiox-integration.ts` lê `.codex/agents/*.md` em runtime (quebra na Vercel) | `apps/web/src/lib/agents/aiox-integration.ts:39` |
| B10 | Stripe `mode:'payment'` sem subscription, `Tcc.content` sem limite | múltiplos |

---

## 8. Workflow padrão de execução

1. **Antes de codar** (≤5 linhas em PT-BR):
   - O que entendi da tarefa.
   - Workspace e arquivos a tocar.
   - Suposições. Se houver dúvida grande, **pergunta antes**.
2. **Codifica a mudança mínima** que satisfaz o critério de aceite. Sem feature creep.
3. **Roda os gates** do workspace correspondente:
   - `cd apps/web && npm run typecheck && npm run lint`, ou
   - `cd services/ai && uv run ruff check . && uv run mypy . && uv run pytest -q`
   Todos verdes antes de declarar pronto.
4. **Atualiza docs** se mudou contrato (ADR, STATUS, feature spec).
5. **Output final** em PT-BR:
   - Lista de arquivos criados/modificados (1 linha cada).
   - Comando pra testar localmente.
   - Riscos / o que **não** foi feito.

---

## 9. Convenções de código

- **TypeScript strict.** `any` só com justificativa de 1 linha.
- **Path alias** dentro de `apps/web/`: `@/*` → `apps/web/src/*`.
- **Server Components por padrão.** `"use client"` só onde precisa de estado/efeito.
- **Comentários:** explique **por quê**, não **o quê**.
- **Erros pro usuário:** PT-BR, 1 frase, acionável.
- **Logs servidor:** `console.error("[scope]", error)` com prefixo.
- **Commits:** `<tipo>(<escopo>): <descrição>` em PT-BR. Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. Escopo: nome do diretório (`api`, `web`, `ai`, `quota`).
- **Sem emoji** em código, commits ou docs.

Para regras Python específicas (mypy strict, structlog, pydantic v2 frozen), consulte `services/ai/AGENTS.md`.

---

## 10. Decisões pendentes

- [ ] BL-006 — Provedor Redis (Upstash vs Vercel KV).
- [ ] BL-007 — Host FastAPI (Fly.io vs Render vs Railway).
- [ ] BL-008 — Gerar client TS a partir do OpenAPI do FastAPI (sim/não).

Se a tarefa depender de uma dessas, **pare e pergunta**.

---

## 11. Onde buscar mais contexto

| Quando precisa de... | Lê |
|---|---|
| Decisão arquitetural | `docs/adr/000X-*.md` |
| Backlog de tarefas | `docs/BACKLOG.md` |
| Status / fase atual | `STATUS.md` |
| Modelo de dados produto | `apps/web/prisma/schema.prisma` |
| Limites por plano | `apps/web/src/lib/plan.ts` |
| Ações de IA disponíveis | `apps/web/src/lib/agents/guardrails.ts` |
| Regras Python específicas | `services/ai/AGENTS.md` |

**Nunca leia o repo todo.** Vá direto ao arquivo do escopo.

---

## 12. Comunicação com o humano

- **Idioma:** PT-BR. Termos técnicos em inglês ok.
- **Ambiguidade:** pergunta antes de codar.
- **Output curto.** Diff mostra o quê — comente só o porquê.
- **Sem emoji** em qualquer artefato (texto, código, commits, docs).

---

## 13. Ciclo de revisão

1. Codex executa a tarefa seguindo este AGENTS.md.
2. Codex commita em branch (ou direto na main no estágio atual) e descreve diff.
3. **Revisão por outro agente (Claude)** focada em:
   - Aderência às regras das seções 6 e 7.
   - Regressão de bugs B1–B10.
   - Side-effects fora do escopo.
   - Qualidade dos prompts (se tarefa tocou IA).
4. Humano aprova ou pede ajustes.

---

## 14. Sinais de que esta skill está desatualizada

Atualize na mesma tarefa que descobriu o gap:

- ADR foi criado/superado → §4.
- Bug B1–B10 foi resolvido → §7 (remova).
- Novo arquivo grande ou módulo → §5 (repo map).
- Decisão pendente da §10 foi tomada → mova pra §4.
- Stack mudou → §3.
