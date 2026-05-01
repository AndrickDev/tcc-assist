# ADR-0001 — Separação do serviço de IA em FastAPI com RAG

- **Status:** Aceito
- **Data:** 2026-04-28
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, ia, rag, backend

---

## Contexto

Hoje toda a lógica de IA mora dentro das rotas Next.js:

- `src/app/api/chat/route.ts` chama `runTccWorkflow` (em `src/lib/agents/aiox-integration.ts`).
- `src/app/api/gerar-tcc/route.ts` chama `callGemini`/`callGeminiWithFiles` direto.
- `src/app/api/tcc/[id]/ai-action/route.ts` monta prompt via `buildActionPrompt` e chama Gemini.
- `aiox-integration.ts` ainda faz `fs.readFileSync('.codex/agents/<id>.md')` em runtime para carregar prompts (B9).

Limitações que isso impõe:

1. **Timeout da Vercel.** Funções serverless do plano atual estouram em 10–60s. Geração de capítulo VIP (8 páginas) já encosta no limite e não tem fôlego pra adicionar retrieval, rerank e batch de embeddings.
2. **Cold start.** A cada chamada paga-se setup de runtime + dependências pesadas (Prisma + Gemini SDK potencial + futuro pgvector). Inviabiliza manter modelo de embedding em memória.
3. **Acoplamento.** Próximos passos (RAG sobre PDFs do usuário, embeddings locais, rerank, observabilidade de prompts) puxam dependências Python-nativas (`sentence-transformers`, `pgvector`, `unstructured`, `langfuse`) que não rodam bem ou são desnecessariamente caras em Node serverless.
4. **Quota e rate limit centralizados.** Hoje o limite diário vive em `localStorage` (B3) e `/api/chat` é a única rota que conta — `/api/gerar-tcc` e `/api/tcc/[id]/ai-action` escapam (B4). Precisamos de um único ponto que conte chamadas, persista em Redis e responda sub-50ms.
5. **Versionamento de prompts.** Carregar prompts de `.md` em runtime é frágil em deploy. Queremos prompts em código versionado, com changelog e testes.

A alternativa "deixar no Next" continuaria empilhando dívida nesses cinco vetores ao mesmo tempo.

## Decisão

Separar a camada de IA em um **serviço FastAPI dedicado** ("tcc-assist-ai"), comunicando-se com o Next.js via HTTP autenticado (JWT interno).

**Responsabilidades por serviço:**

| Next.js (mantém) | FastAPI (novo) |
|---|---|
| UI (workspace, dashboard, login) | Orquestração de agentes (chat, geração, ações) |
| Auth (NextAuth) e sessão | Pipeline RAG (chunk, embed, retrieve, rerank) |
| Stripe (checkout + webhook) | Provider Gemini (geração) + bge-m3 (embeddings local) |
| CRUD via Prisma (TCC, mensagens, refs, anexos) | Quota e rate limit (Redis) |
| Upload p/ Vercel Blob | Templates de prompts versionados (Python, com testes) |
| BFF que chama FastAPI | Observabilidade de prompts (langfuse / phoenix) |

**Comunicação Next ↔ FastAPI:**

- HTTP entre serviços (FastAPI nunca exposto ao browser).
- JWT curto (`exp=60s`) assinado com `INTERNAL_JWT_SECRET` (compartilhado).
- Payload mínimo: `{ sub: userId, plan, tccId, scope: "chat"|"generate"|"action" }`.
- FastAPI valida, lê quota do Redis, executa, retorna. Não persiste mensagens — Next continua dono da escrita no Postgres (fonte única de verdade do histórico).

**Stack do FastAPI:**

- Python 3.11+, `uv` para dependency management.
- `ruff` + `mypy --strict` + `pytest`.
- Estrutura: `app/{api,orchestrator,rag,providers,prompts,quota,observability}/`.
- Persistência: lê o Postgres do Next (mesma DB, tabela `chunks`/`embeddings` em pgvector via Alembic). Não duplica modelo de TCC/Message.
- Hospedagem: Fly.io ou Render (a definir — ver decisão pendente em `AGENTS.md` §9).

## Consequências

### Positivas
- Geração longa (>10s) deixa de competir com timeout Vercel.
- Modelo de embedding fica residente em memória → latência sub-segundo no retrieval.
- Quota e rate limit ganham um dono único (Redis no FastAPI), encerrando B3 e B4.
- Prompts viram código Python testável, com fixture de Gemini mockado em CI.
- Adicionar RAG real fica viável (pgvector + chunking + rerank) sem inflar bundle do Next.
- Trocar provider (GPT, Claude) vira mudar arquivo em `providers/` — Next não vê.

### Negativas
- Mais um serviço pra deployar, monitorar e pagar (~US$5–20/mês no nível atual).
- Latência adicional Next → FastAPI (1 hop, ~30–80ms com regiões próximas).
- Schema do Postgres precisa ser administrado por dois lados (Prisma e Alembic). Convenção: **Prisma é dono do schema "produto"** (User, Tcc, Message, Reference, Attachment); **Alembic é dono do schema "RAG"** (Chunk, Embedding, IngestionJob). Sem sobreposição.
- Compartilhar `INTERNAL_JWT_SECRET` adiciona uma chave a gerenciar.

### Neutras
- O cliente (browser) continua só conversando com Next. Zero mudança de superfície de API pública.
- `src/lib/ai/provider.ts` perde sentido no Next e some; o equivalente passa a viver em `providers/` no FastAPI.

## Alternativas consideradas

**A. Manter tudo no Next.js, otimizar.**
Rejeitada. O ganho marginal não cobre o custo de operar embeddings/RAG em runtime serverless.

**B. Serverless GPU (Modal, Replicate, Beam).**
Rejeitada agora. Boa pra LLM local pesado, overkill pra Gemini API + embedding pequeno. Reavaliar se fizermos fine-tune ou rodar Llama local.

**C. Edge Runtime do Next (workers).**
Rejeitada. Não roda Python, não tem GPU, runtime restrito.

**D. Monorepo com Next + Python no mesmo deploy.**
Rejeitada. Vercel não roda Python como first-class; Render/Fly não fazem deploy de Next App Router tão bem quanto Vercel. Cada serviço no seu hosting nativo é mais simples.

## Notas de implementação

- Repositório separado: `tcc-assist-ai` (próximo do `tcc-assist`).
- Primeiro endpoint a portar: `POST /v1/chat` (replica `runTccWorkflow`). Cut-over com feature flag `USE_FASTAPI_AI` no Next, 1% → 10% → 100%.
- Segunda fase: `POST /v1/generate` (substitui `/api/gerar-tcc`).
- Terceira fase: `POST /v1/actions/{action}` (substitui `/api/tcc/[id]/ai-action`).
- Após cut-over completo, deletar `src/lib/gemini.ts`, `src/lib/ai/provider.ts`, `src/lib/agents/`.

## Referências

- AGENTS.md §2 (stack alvo), §4 (decisões), §6 (workflow).
- ADR-0002 — pgvector como vector store (a escrever quando começar ingestão).
- ADR-0003 — Gemini API ao invés de LLM local (a escrever).
- ADR-0006 — Comunicação Next ↔ FastAPI por JWT interno (a escrever).
