# Backlog — Teseo / TCC-Assist

> Fila de coisas descobertas durante outras tarefas, ou planejadas, mas que **não entram** na tarefa em curso.
> Bugs catalogados em `AGENTS.md §7` (B1–B10) **não** são duplicados aqui.
> Atualize na mesma tarefa que descobriu o item.

---

## Convenção

Cada item tem:

- **ID:** `BL-NNN` sequencial.
- **Título:** 1 linha imperativa.
- **Origem:** onde apareceu (PR, conversa, observação).
- **Tamanho estimado:** XS (<1h), S (1–4h), M (½–1 dia), L (1–3 dias), XL (>3 dias).
- **Critério de pronto:** o que precisa existir/funcionar pra fechar.

Status implícito por seção: itens em "Em andamento" estão sendo executados; em "Próximos" são candidatos imediatos; em "Depois" ficam pra quando houver capacidade.

---

## 🚧 Em andamento

### BL-016 — Cut-over `/api/gerar-tcc` para `POST /v1/generate`
- **Origem:** T-H2, ADR-0001, ADR-0006 e PR #50 do FastAPI.
- **Tamanho:** M
- **Status:** BFF bifurcado por `USE_FASTAPI_GENERATE` com default off. Quando ligado, `/api/gerar-tcc` delega ao FastAPI `POST /v1/generate`; quando desligado, preserva o caminho legacy com Gemini direto e PDFs anexados.
- **Trade-offs:** FastAPI depende da ingestão RAG para usar fontes (`require_sources=true`) e não processa PDFs anexados em tempo de geração. Usuários com attachments perdem esse contexto quando a flag for ligada até o fluxo de ingestão cobrir esse caso.
- **Próximos passos:** canary controlado em produção, smoke com TCCs sem e com referências ingeridas, depois T-H3 remove legado `callGemini`/`callGeminiWithFiles` da rota.

### BL-014 — Cut-over `/api/tcc/[id]/ai-action` para `POST /v1/actions/{action}`
- **Origem:** ADR-0001, fase 6 do roadmap.
- **Tamanho:** M
- **Status:** T-F1 (PR #26) e T-F2 (PR #27) mergeados em 2026-05-20. Falta flip `USE_FASTAPI_ACTIONS=true` em prod + T-F3 cleanup do legado `aiox-action`.
- **Próximos passos:** smoke prod pós-flip, T-F3 remove `apps/web/src/lib/gemini.ts` callsites de action + flag.

## ✅ Concluído recentemente

### BL-015 — Pipeline RAG completo (fase 4 do roadmap)
- **Status:** concluído em 2026-06-03. T-G1 (schema pgvector dim 768, PR #28) + T-G2/T-G2.1 (`EmbeddingProvider` com `gemini-embedding-001`, MRL 768, L2 norm, cache Redis, PRs #30/#31) + T-G3/T-G3.1 (PDF ingestion, scope JWT `ingest`, fixture `reportlab`, PRs #32/#33) + T-G4 (OpenAlex abstract ingestion, PR #34) + T-G5 (`POST /v1/retrieve` com pgvector cosine top-k, scope `retrieve`, PR #35) + T-G6 (hook RAG no `run_chat` com `ChatResult.citations`, PR #36) + T-G7/T-G7.1 (docker-compose dev + smoke E2E real, PRs #37/#38).
- **Decisão de provider:** `bge-m3` local trocado por Google `gemini-embedding-001` MRL 768 (ADR-0008) — runway zero adicional, free tier 1500 RPM, latência ~150-400ms p95.
- **Smoke E2E validado:** ingest reference → retrieve score 0.77 → chat FREE com citações `[1]` referenciando o chunk recuperado.

### BL-010 — Cut-over `/api/chat` para `POST /v1/chat` no FastAPI
- **Status:** concluído em 2026-05-19. Rollout prod ativado 2026-05-13, monitoramento sem incidentes. T-E5 removeu flag USE_FASTAPI_AI, branch legado em /api/chat, aiox-integration.ts, agentes .codex/agents/*.md.

---

## ⏭️ Próximos (ordem de prioridade)

### BL-009 — Bootstrap do repositório FastAPI
- **Origem:** ADR-0001 §"Notas de implementação".
- **Tamanho:** M
- **Critério de pronto:** repo `tcc-assist-ai` com estrutura `app/{api,orchestrator,rag,providers,prompts,quota,observability}/`, Dockerfile, healthcheck `/v1/health`, CI rodando `ruff + mypy + pytest`.

---

## 📅 Depois (não esquecer, mas não prioritário)

### BL-008 — Gerar client TS a partir do OpenAPI do FastAPI
- **Origem:** AGENTS.md §10.
- **Tamanho:** S
- **Adiado:** com 4-5 endpoints, manutencao manual de tipos no Next e simples. Reavaliar quando: o FastAPI tiver 15+ rotas OU manter tipos manuais virar gargalo (medido em tempo perdido / bugs de contrato).

### BL-101 — Refatorar `src/app/tcc/[id]/page.tsx` (1144 linhas → hooks)
- **Origem:** revisão arquitetural 2026-04-28.
- **Tamanho:** L
- **Critério de pronto:** workspace dividido em `useTccChat`, `useAutosave`, `useDailyLimit`, `useAttachments`, `useReviewMode`. Componente principal ≤300 linhas.

### BL-102 — Confirmação de e-mail no cadastro
- **Origem:** STATUS.md "Falta fazer".
- **Tamanho:** M
- **Critério de pronto:** envio de magic-link, fluxo de verificação, bloqueio de login antes de verificar (configurável).

### BL-103 — Recuperação de senha
- **Origem:** STATUS.md "Falta fazer".
- **Tamanho:** M
- **Critério de pronto:** rota `/forgot-password`, e-mail com token, troca de senha em página dedicada.

### BL-106 — Histórico de versões do documento
- **Origem:** STATUS.md "Falta fazer média prioridade".
- **Tamanho:** L
- **Critério de pronto:** snapshot diário do `tcc.content`, UI lateral pra restaurar versão.

### BL-107 — Notificações de prazo
- **Origem:** STATUS.md "Falta fazer média prioridade".
- **Tamanho:** M
- **Critério de pronto:** worker que dispara e-mail quando `deadline - now` < 7d e < 1d.

### BL-108 — Busca/filtro nos projetos do dashboard
- **Origem:** STATUS.md "Falta fazer média prioridade".
- **Tamanho:** S
- **Critério de pronto:** input de busca por título/curso, filtro por status.

### BL-109 — Onboarding PRO pós-upgrade (momento de celebração)
- **Origem:** STATUS.md "Falta fazer média prioridade".
- **Tamanho:** S
- **Critério de pronto:** modal/tela mostrada após webhook Stripe confirmar upgrade.

### BL-110 — Tooltips na toolbar de ações de IA
- **Origem:** STATUS.md M4.
- **Tamanho:** XS
- **Critério de pronto:** todos os botões da `AiActionToolbar` com tooltip explicando o que cada ação faz.

### BL-111 — Atalhos de teclado para ações rápidas
- **Origem:** STATUS.md M3.
- **Tamanho:** S
- **Critério de pronto:** Ctrl+R (revisar), Ctrl+E (exportar), Ctrl+S (salvar agora) — registrar em `docs/features/keyboard-shortcuts.md`.

### BL-112 — Contador de palavras e caracteres no editor
- **Origem:** STATUS.md M2.
- **Tamanho:** XS
- **Critério de pronto:** contador no rodapé do `EditableRichText`, atualiza com debounce.

### BL-113 — Avatar do usuário no nav rail
- **Origem:** STATUS.md M6.
- **Tamanho:** XS
- **Critério de pronto:** se `session.user.image` existe, mostra; senão mantém inicial.

### BL-114 — Modo escuro refinado com novo design system
- **Origem:** STATUS.md "Backlog baixa prioridade".
- **Tamanho:** M
- **Critério de pronto:** todas as superfícies revisadas em `data-theme="dark"`, contraste WCAG AA.

### BL-116 — Internacionalização (i18n)
- **Origem:** STATUS.md "Backlog baixa prioridade".
- **Tamanho:** XL
- **Critério de pronto:** strings extraídas em `messages/{pt,en}.json`, troca de idioma em `/configuracoes`.

### BL-117 — Importação de referências do Mendeley/Zotero
- **Origem:** STATUS.md "Backlog baixa prioridade".
- **Tamanho:** L
- **Critério de pronto:** OAuth com cada serviço, mapeamento de campos pra `Reference`.

---

## 🗑️ Descartados (não fazer)

### BL-X01 — LLM local rodando geração de TCC
- **Decisão:** descartado em ADR-0003. Reavaliar se passar de 10k usuários pagantes OU se houver requisito específico de privacidade.

### BL-X02 — Migrar pra vector DB dedicado (Pinecone/Qdrant/Weaviate)
- **Decisão:** descartado em ADR-0002. pgvector cobre até alguns milhões de chunks. Reavaliar quando bater nesse limite.

### BL-X03 — Manter Stripe `mode: 'payment'` com extensão manual de plano
- **Decisão:** descartado em ADR-0004. Toda mudança de monetização daqui pra frente assume subscription.

---

## ✅ Concluídos

### BL-001 — Escrever ADR-0002: pgvector como vector store
- **Origem:** AGENTS.md §4 referencia ADR-0002 mas não existia.
- **Tamanho:** XS
- **Concluído em:** `docs/adr/0002-pgvector.md`.

### BL-002 — Escrever ADR-0003: Gemini API ao invés de LLM local
- **Origem:** AGENTS.md §4.
- **Tamanho:** XS
- **Concluído em:** `docs/adr/0003-gemini-not-local.md`.

### BL-011 — Migrar para monorepo (apps/web + services/ai)
- **Origem:** ADR-0007.
- **Tamanho:** M
- **Concluído em:** este commit. ADR-0007 formaliza a decisao.

### BL-003 — Escrever ADR-0004: Stripe subscription
- **Origem:** AGENTS.md §4 + B5.
- **Tamanho:** XS
- **Concluído em:** `docs/adr/0004-stripe-subscription.md`.

### BL-004 — Escrever ADR-0005: Quota e rate limit em Redis
- **Origem:** AGENTS.md §4 + B3 + B4.
- **Tamanho:** XS
- **Concluído em:** `docs/adr/0005-redis-quota.md`.

### BL-005 — Escrever ADR-0006: JWT interno Next ↔ FastAPI
- **Origem:** AGENTS.md §4.
- **Tamanho:** XS
- **Concluído em:** `docs/adr/0006-internal-jwt.md`.

### BL-005-impl — Implementar JWT interno Next ↔ FastAPI e BFF de quota
- **Origem:** ADR-0005 + ADR-0006.
- **Tamanho:** M
- **Concluído em:** commits `406147b`, `ddeb423` e este commit. Inclui verifier FastAPI, `GET /v1/quota/me`, signer Next e BFF `GET /api/quota/me`.

### BL-006 — Decidir provedor Redis (Upstash vs Vercel KV)
- **Origem:** AGENTS.md §10.
- **Tamanho:** XS
- **Concluido em:** este commit. Decisao: Upstash. Motivos: free tier 10k req/dia, desacoplado da Vercel, REST + TCP, latencia BR aceitavel.

### BL-007 — Decidir host FastAPI (Fly.io vs Render vs Railway)
- **Origem:** AGENTS.md §10.
- **Tamanho:** XS
- **Concluido em:** este commit. Decisao: Fly.io. Motivos: VM sempre quente (mantem bge-m3 em memoria), regiao GRU, deploy from Dockerfile, US$5/mes cobre VM 256MB inicial.
