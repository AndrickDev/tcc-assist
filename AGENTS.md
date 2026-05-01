# AGENTS.md — Teseo / TCC-Assist

> Fonte de verdade operacional pro Codex CLI (e qualquer agente IA).
> Carregado automaticamente em toda sessão. Mantenha curto e atual.
> Se algo aqui estiver desatualizado, corrija ANTES de continuar a tarefa.
>
> Última atualização: 2026-04-28

---

## 1. Produto

**Teseo (TCC-Assist)** é um SaaS BR que ajuda alunos a escreverem TCC com IA:
geração de capítulos, citações ABNT, busca de referências reais (OpenAlex),
revisão e exportação PDF. Planos FREE / PRO / VIP via Stripe.

**Estado:** beta controlado, 1 dev solo, sem usuários pagantes ainda.
Pode-se quebrar schema/API sem migration backward-compat.

---

## 2. Stack — atual e alvo

| Camada | Hoje | Alvo (em migração) |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, Tiptap, Tailwind v4 | Mesmo |
| BFF / Auth / Stripe | Next.js API routes, NextAuth v5 beta, Prisma 5 | Mesmo |
| **IA / RAG** | `callGemini` direto no Next + prompts hardcoded | **FastAPI separado** + RAG sobre pgvector + Gemini Flash via API |
| DB | Postgres (env `POSTGRES_URL`) | + extensão `pgvector` |
| Quota / rate limit | `localStorage` (bypass trivial) | Redis (Upstash) |
| Pagamento | Stripe `mode:'payment'` (one-shot) | Stripe `mode:'subscription'` |
| Storage | Vercel Blob | Mesmo |
| Embeddings | — | `BAAI/bge-m3` local no FastAPI |

---

## 3. Repo map — só o que importa

```
src/
├ app/
│ ├ api/
│ │ ├ chat/route.ts            ← orquestrador IA (virará proxy p/ FastAPI)
│ │ ├ gerar-tcc/route.ts       ← geração de capítulo (idem)
│ │ ├ tcc/[id]/
│ │ │ ├ route.ts               ← CRUD do TCC
│ │ │ ├ ai-action/route.ts     ← revisar/abnt/citações/próximo-passo
│ │ │ ├ messages/              ← chat history
│ │ │ ├ references/            ← OpenAlex search + select + compare
│ │ │ ├ attachments/           ← upload PDF p/ Blob
│ │ │ └ stats/                 ← métricas (HOJE FAKE — ver B6)
│ │ ├ stripe/                  ← checkout + webhook
│ │ └ admin/                   ← gerenciar planos (role check)
│ ├ tcc/[id]/page.tsx          ← workspace (1144 linhas — quebrar em hooks)
│ └ dashboard/page.tsx
├ lib/
│ ├ auth.ts                    ← NextAuth Node (com Prisma)
│ ├ auth.config.ts             ← NextAuth edge (sem Prisma, p/ middleware)
│ ├ plan.ts                    ← FONTE ÚNICA de limites por plano
│ ├ prisma.ts
│ ├ stripe.ts
│ ├ gemini.ts                  ← `callGemini` (sumirá do Next)
│ ├ ai/provider.ts              ← abstração de provider (idem)
│ ├ agents/aiox-integration.ts ← orquestrador (virará serviço FastAPI)
│ ├ agents/guardrails.ts        ← prompts por ação (portar p/ Python)
│ ├ papers-search.ts            ← OpenAlex client (MANTER)
│ └ references.ts               ← formatação ABNT (MANTER)
prisma/
└ schema.prisma                 ← User, Tcc, Message, Reference, Attachment
docs/                           ← (criar conforme migração avança)
├ adr/                          ← Architecture Decision Records
├ features/                     ← spec end-to-end por feature
└ runbooks/                     ← incident response
```

---

## 4. Decisões arquiteturais já tomadas (NÃO rediscuta — execute)

- **ADR-0001** — IA roda em FastAPI separado. Next vira BFF.
- **ADR-0002** — Vector store é `pgvector` no Postgres existente. NÃO introduzir Pinecone/Qdrant/Weaviate.
- **ADR-0003** — LLM gerador é Gemini Flash via API. Local só pra embeddings (`bge-m3`) e, eventualmente, reranker.
- **ADR-0004** — Stripe migra pra `mode:'subscription'`. Não estender mais nada em `mode:'payment'`.
- **ADR-0005** — Quota e rate limit são server-side (Redis). Nada em `localStorage`.
- **ADR-0006** — Comunicação Next ↔ FastAPI por HTTP com JWT interno (`INTERNAL_JWT_SECRET`). FastAPI nunca exposto direto ao browser.

Se um ADR ainda não tem arquivo em `docs/adr/`, **crie o arquivo antes de codar** a tarefa relacionada.

---

## 5. Regras duras (não negociáveis)

### Segurança
- **Toda rota** que recebe `tccId` deve fazer `prisma.tcc.findFirst({ where: { id, userId } })` antes de qualquer leitura/mutação.
- **Nunca** confie em `session.user.role` sem chamar `auth()` no servidor.
- **Não** adicione env em `next.config.ts > env: {}` — qualquer var listada lá vaza pro bundle do client. Use `process.env.X` direto em código server.
- CORS restrito a `process.env.NEXT_PUBLIC_APP_URL`. **Não** use `*` com `Allow-Credentials: true`.
- Webhooks externos (Stripe etc.) precisam de **assinatura validada + idempotência** (tabela `processed_events` ou similar).

### Tipos / qualidade
- `npm run typecheck` precisa passar com **0 erros** antes de declarar tarefa pronta.
- `npm run lint` precisa passar com 0 erros.
- **Não** silencie com `as any`, `@ts-expect-error`, `// eslint-disable-*` — corrija a causa. Exceções: lib externa sem types (justifique em comentário de 1 linha).

### Banco
- Mudou `schema.prisma` → `npx prisma migrate dev --name <descritivo>` na mesma tarefa.
- Não use `prisma db push` em código que vai pra main.
- Coluna usada em `where` de query quente → adicione `@@index`.

### Escopo
- Execute **apenas** o pedido. Sem refator lateral, sem "já que eu estava aqui...".
- Bug fora do escopo? **Anota em `docs/BACKLOG.md`**, não corrige no PR atual.
- Arquivo passou de 500 linhas? Sinal de quebrar — mas só se for relacionado à tarefa.

---

## 6. Workflow padrão de execução

1. **Antes de codar**, responda em ≤5 linhas em PT-BR:
   - O que entendi da tarefa.
   - Arquivos que vou tocar.
   - Suposições (se houver dúvida grande, **pergunta antes**).
2. **Codifica a mudança mínima** que satisfaz o critério de aceite. Sem feature creep.
3. **Roda os gates** localmente:
   ```bash
   npm run typecheck
   npm run lint
   npm test            # quando aplicável
   ```
   Para FastAPI (quando existir): `ruff check . && mypy . && pytest -q`.
4. **Atualiza docs** se mudou algo arquitetural (novo ADR, atualiza STATUS.md, registra em features/).
5. **Output final**, em PT-BR, contendo:
   - Lista de arquivos criados/modificados (1 linha cada explicando o porquê).
   - Comando pra testar localmente.
   - Riscos / o que **não** foi feito (tarefas adiadas).

---

## 7. Bugs conhecidos — NÃO regrida, considere corrigir se trivial e in-scope

| ID | Descrição | Local |
|---|---|---|
| B1 | CORS `*` + `Allow-Credentials: true` | `next.config.ts:9-21` |
| B2 | `GOOGLE_API_KEY` exposto em `env: {}` (vaza pro client) | `next.config.ts:6-8` |
| B3 | Limite diário em `localStorage` (bypass trivial) | `src/app/tcc/[id]/page.tsx:68` |
| B4 | `/api/chat`, `/api/gerar-tcc`, `/api/tcc/[id]/ai-action` sem rate limit | rotas `/api/*` |
| B5 | Webhook Stripe sem idempotência — replay re-aplica plano | `src/app/api/stripe/webhook/route.ts` |
| B6 | `stats/route.ts` calcula progresso/plágio com regex em texto livre (fake) | `src/app/api/tcc/[id]/stats/route.ts` |
| B7 | Type errors: `EventName` faltando `REVIEW_ACCEPTED`/`REJECTED`; `messageId` em `never` | `src/app/tcc/[id]/page.tsx:552,559,759,763,765` |
| B8 | Roles checados via `@ts-expect-error` em rotas admin | `src/app/api/admin/**` |
| B9 | `aiox-integration.ts` lê `.codex/agents/*.md` em runtime via `fs` (quebra silencioso na Vercel) | `src/lib/agents/aiox-integration.ts:39` |
| B10 | `Tcc.content`, mensagens de chat e Stripe `mode:'payment'` sem migration plan | múltiplos |

---

## 8. Convenções de código

- **TypeScript strict.** `any` só com justificativa de 1 linha.
- **Path alias:** `@/*` → `src/*`.
- **Server Components por padrão.** `"use client"` só quando precisa de estado/efeito/event.
- **Comentários:** explique **por quê**, não **o quê**. Nada de JSDoc em coisa óbvia.
- **Erros pro usuário:** PT-BR, 1 frase, acionável.
- **Logs servidor:** `console.error("[scope]", error)` com prefixo do módulo.
- **Commits:** `<tipo>(<escopo>): <descrição>` em PT-BR. Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- **Mensagens pro usuário sempre PT-BR.** Mensagens de log/commit também.

### FastAPI (quando existir)

- Python 3.11+, `ruff` + `mypy --strict`, `uv` pra dependency management.
- Estrutura: `app/{api,orchestrator,rag,providers,prompts,quota,observability}/`.
- Testes: `pytest`, mock de Gemini com fixture (sem chamar API real em CI).
- Logging estruturado com `structlog`. Toda chamada de IA loga `tokens_in/out`, `latency_ms`, `model`, `userId`, `tccId`.

---

## 9. Decisões pendentes (precisa de input humano)

- [ ] Provedor Redis: Upstash vs Vercel KV.
- [ ] Host FastAPI: Fly.io vs Render vs Railway.
- [ ] Gerar client TS a partir do OpenAPI do FastAPI (sim/não).
- [ ] Stripe: rolar pra subscription antes ou depois do FastAPI.

Se a tarefa depender de uma dessas, **pare e pergunte** — não suponha.

---

## 10. Onde buscar mais contexto (não leia o repo todo)

| Quando precisa de... | Lê |
|---|---|
| Decisão de "por quê fizemos X" | `docs/adr/000X-*.md` |
| Spec de uma feature end-to-end | `docs/features/<feature>.md` |
| O que está pronto / o que falta | `STATUS.md` |
| Modelo de dados | `prisma/schema.prisma` |
| Limites por plano | `src/lib/plan.ts` |
| Ações de IA disponíveis | `src/lib/agents/guardrails.ts` |

**Nunca leia o repo inteiro.** Vá direto ao doc/arquivo do escopo. Se a info não existe num desses lugares, **crie o doc** durante a tarefa em vez de inferir.

---

## 11. Comunicação com o humano

- **Idioma:** PT-BR. Termos técnicos em inglês ok (`endpoint`, `webhook`, `embedding`).
- **Ambiguidade:** pergunta antes de codar.
- **Bug fora de escopo:** anota em `docs/BACKLOG.md` (cria se não existir), não corrige.
- **Output curto.** O humano vai ler o diff. Não escreva 400 linhas explicando.
- **Sem emoji** no código, commits ou docs (exceto se o humano pedir).

---

## 12. Ciclo de revisão

1. Codex executa a tarefa seguindo este AGENTS.md.
2. Codex commita em branch (`feat/<escopo>` ou similar) e abre PR (ou descreve diff).
3. **Outro agente (Claude) faz code review** focado em:
   - Aderência às regras das seções 5 e 7 deste arquivo.
   - Regressão de bugs B1–B10.
   - Side-effects fora do escopo.
   - Qualidade dos prompts (se tarefa tocou IA).
4. Humano aprova ou pede ajustes. Codex ajusta. Loop até OK.

---

## 13. Sinais de que esta skill está desatualizada

Se você (Codex) bater num desses sinais, **atualize este arquivo na mesma tarefa**:

- Algum bug B1–B10 foi resolvido → remova da tabela.
- Algum ADR foi criado/superado → atualize seção 4.
- Algum arquivo grande foi quebrado → ajuste o repo map (seção 3).
- Decisão pendente da seção 9 foi tomada → mova pra seção 4.
- Stack mudou → atualize seção 2.
