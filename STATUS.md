# Teseo — Status do Projeto
> Atualizado em: 2026-05-18 · Branch: `main`

---

## 📍 Fase atual — Migração arquitetural (IA → FastAPI + RAG)

O produto entrou em fase de reescrita da camada de IA. UI/auth/Stripe permanecem em Next.js;
toda lógica de IA (chat, geração, ações, RAG) migra para um serviço FastAPI dedicado.
Decisão fixada em [ADR-0001](./docs/adr/0001-fastapi-rag-split.md).

**Princípios desta fase:**
- Cut-over endpoint a endpoint, com feature flag `USE_FASTAPI_AI` no Next.
- Nada novo entra no Next em `src/lib/agents/` ou `src/lib/gemini.ts` — esses arquivos vão sumir.
- Toda nova feature de IA é desenhada primeiro como contrato HTTP (rota FastAPI).
- Quota e rate limit migram para Redis no FastAPI (encerra B3 e B4).

### Roadmap macro

| Fase | Escopo | Estado |
|---|---|---|
| 0 | Documentação base (AGENTS.md, ADR-0001, BACKLOG.md, STATUS.md) | ✅ feito |
| 0.5 | Migração para monorepo (apps/web + services/ai) — ADR-0007 | concluído |
| 1 | Bootstrap repositório `tcc-assist-ai` (FastAPI + CI + healthcheck) | concluído |
| 2 | Quota server-side em Redis + endpoint `/v1/quota/me` + BFF Next | concluído |
| 3 | Cut-over `/api/chat` → `POST /v1/chat` (paridade) | rollout em produção, monitoramento 1–3 dias |
| 4 | Pipeline RAG: ingestão (PDFs + OpenAlex) + pgvector | 🔲 |
| 5 | Cut-over `/api/gerar-tcc` → `POST /v1/generate` (com retrieval) | 🔲 |
| 6 | Cut-over `/api/tcc/[id]/ai-action` → `POST /v1/actions/{action}` | 🔲 |
| 7 | Stripe `subscription` + idempotência do webhook | 🔲 |
| 8 | Observabilidade (langfuse/phoenix) + métricas de qualidade do RAG | 🔲 |

Tarefas detalhadas em [BACKLOG.md](./docs/BACKLOG.md). Bugs ativos em `AGENTS.md §7`.

---

## ✅ Concluído

### Workspace (editor principal)
- Documento central com editor rico (Tiptap) — bold, italic, headings, listas, citações, undo/redo
- Autosave robusto: debounce 2s, status visual ("Salvando…" / "Salvo em nuvem" / "Erro ao salvar")
- Botão "Salvar Agora" manual quando há conteúdo não salvo
- Inserção segura de sugestões da IA — sem sobrescrever conteúdo existente
- Cards de sugestão com prévia, botão "Inserir" e "Descartar"
- Regeneração de sugestão por card individual
- Assistente lateral (painel direito) com abas Sugestões / Métricas
- Onboarding de primeiro acesso no workspace vazio com prompts iniciais acionáveis
- AiActionToolbar: revisar, formatar ABNT, melhorar citações, próximo passo
- Ações bloqueadas por plano com UpgradeModal contextual
- Limite diário de mensagens (FREE: 3, PRO: 50, VIP: ∞) com LimitModal
- Exportação PDF: com marca d'água (FREE), sem marca d'água (PRO/VIP)
- Upload de referências (PDF/DOC/DOCX) com limite por plano
- TccSidebar: progresso %, turnitin %, autoria %, total de páginas
- Header do workspace mostra título, curso, norma e badge de plano
- Rota de AI Actions (`/api/tcc/[id]/ai-action`) com guardrails de prompt
- Abstração de provider de IA (`src/lib/ai/provider.ts`)

### Dashboard
- Redesign completo: empty state premium + grid de cards de projeto
- Empty state: ícone, headline editorial serif, 3 feature pills, CTA clara
- Cards de projeto: título, tipo/norma badge, status dot, curso/instituição, prazo/data
- Saudação com nome do usuário + stats de vagas em tempo real
- Dashed "add new" card quando há vagas disponíveis
- Upgrade banner quando o limite do plano é atingido (link para `/pricing`)
- Header sticky com PlanBadge, "Novo TCC", "Voltar ao site", logout

### Onboarding (modal de criação de TCC)
- 5 passos: Tema → Dados acadêmicos → Tipo e norma → Prazo e objetivo → Confirmar
- Barra de progresso terracotta (brand-accent)
- Nome do passo no nav central: "Tema · 1 de 5"
- Slide transition horizontal entre steps
- `Ctrl+Enter` avança o step 1
- Microcopy explicativo em cada passo
- Step 5: tabela de resumo estruturada com label/valor
- Slot limit error no step 5 com CTA de upgrade

### Analytics / Telemetria
- `analytics.ts` com 17 eventos tipados, agrupados por estágio do funil
- Onboarding: `ONBOARDING_STEP`, `TCC_CREATED`
- Dashboard: `TCC_DELETED`
- Workspace: `WORKSPACE_OPEN`, `MANUAL_SAVE_TCC`, `INSERT_SUGGESTION_DOCUMENT`, `AI_SUGGESTION_REGENERATE`
- AI Actions: `AI_ACTION_CLICK`, `AI_ACTION_BLOCK_PLAN`, `AI_ACTION_SUCCESS`, `AI_ACTION_ERROR`, `AI_PANEL_TOGGLE_NEXT_STEP`
- Monetização: `UPGRADE_MODAL_SHOWN`, `UPGRADE_CTA_CLICK`, `LIMIT_MODAL_SHOWN`, `EXPORT_CLICK`
- Engagement: `TURNITIN_INFO_HOVER`
- PostHog conectado em produção: `posthog-js` inicializado em `PostHogProvider` (client component), `$pageview` em mudança de rota, `identify`/`reset` no login/logout, `trackEvent` envia via `window.posthog.capture` com fallback `console.info` quando SDK ausente. Smoke validado em 2026-05-18 (pageview + identify chegaram no dashboard).

### UX / Qualidade
- Todos os `alert()` removidos — substituídos por mensagens inline no chat ou erros contextuais
- TccSidebar: erro de upload inline com auto-dismiss (5s)
- TccSidebar: contador de anexos corrigido ("0 de 5" em vez de "0/5 FREE")
- Workspace: fallback de curso corrigido ("—" em vez de "Curso Superior")
- Design system Teseo aplicado: tokens brand-* em toda a entrada do produto
- Páginas de erro customizadas 404 / 500 / global-error no padrão Teseo (BL-104)

### Planos e monetização
- Lógica FREE / PRO / VIP centralizada em `src/lib/plan.ts`
- Slot limits: FREE = 1 TCC, PRO = 1 TCC, VIP = 2 TCCs
- Dev plan switcher para testes locais
- Stripe checkout + webhook estruturados
- Admin panel para gerenciar planos de usuários

### Migração FastAPI — fase 2
- JWT interno HS256 Next ↔ FastAPI implementado conforme ADR-0006
- Quota Redis no FastAPI com endpoint protegido `GET /v1/quota/me`
- BFF Next `GET /api/quota/me` assina JWT interno e normaliza resposta para a UI
- Workspace lê quota diária via BFF `GET /api/quota/me`; gate em `localStorage` removido da UI

### Migração FastAPI — fase 3 (rollout em produção, monitoramento 1–3 dias)
- Cliente Postgres async read-only no FastAPI (`app/db/`) — ADR-0001
- Provider Gemini portado pra Python (`app/providers/gemini.py`) — ADR-0003
- Templates de prompt versionados em código (`app/prompts/chat.py`)
- Orchestrator `run_chat` + endpoint `POST /v1/chat` protegido por JWT scope=chat
- Next BFF `/api/chat` bifurca por flag `USE_FASTAPI_AI`: ON chama FastAPI e salva bot message em Prisma; OFF mantém `runTccWorkflow` legado pra rollback
- Mapeamento de erros 401/403/404/422/429/502/503 com mensagens pt-BR
- `runChat`/`getQuotaState` no Next tratam falha de rede como `ai_provider_unavailable` / `quota_unavailable` (503)
- UI defende contra resposta de erro do BFF sem quebrar (`page.tsx:589-606`)
- Smoke local validado: 7 cenários passaram (FREE 3/3 → 4ª bloqueada antes de `/api/chat`, F5/Redis persiste, VIP ilimitado, FastAPI down → 503, Redis down → 503, flag off comportamento legado)
- Rollout produção ativado em 2026-05-13: `USE_FASTAPI_AI=true` na Vercel, FastAPI no Fly.io (`teseo-ai`), Redis Upstash, Postgres Prisma remoto.
- Smoke produção validado em 2026-05-13: `/api/quota/me` 200, `/api/chat` 200, FREE bloqueia envio após limite via LimitModal.

---

## 🔲 Falta fazer

### Alta prioridade (pré-beta ou primeiras semanas)
- [ ] **Recuperação de senha** — fluxo de "esqueci minha senha" não está implementado
- [ ] **Confirmação de e-mail** — novos cadastros não recebem e-mail de verificação
- [ ] **Rate limiting nas APIs** — sem proteção contra abuso nas rotas de chat e AI actions
- [ ] **Feedback de erro de IA** — quando o  provider falha, o usuário vê mensagem genérica; deveria ser mais orientada

### Média prioridade (pós-beta inicial)
- [ ] **Progresso real do TCC** — o % de progresso é estimado; idealmente reflete seções preenchidas vs. estrutura esperada
- [ ] **Histórico de versões** — não há como o usuário ver versões anteriores do documento
- [ ] **Múltiplos usuários / colaboração** — sem suporte a compartilhamento
- [ ] **Notificações de prazo** — o campo `deadline` existe mas nenhum alerta é gerado
- [ ] **Busca nos projetos** — sem filtro/busca no dashboard quando o usuário tiver 2+ projetos
- [ ] **Onboarding PRO pós-upgrade** — usuário que faz upgrade não tem momento de celebração/orientação

### Baixa prioridade (backlog)
- [ ] **Modo escuro refinado** — dark mode existe mas não foi revisado com o novo design system
- [ ] **Internacionalização (i18n)** — estrutura de I18nProvider existe, mas strings ainda misturadas
- [ ] **App mobile** — produto é responsivo mas não otimizado para mobile como app
- [ ] **Integração com Mendeley/Zotero** — importação de referências bibliográficas
- [ ] **GPT como provider alternativo** — estrutura está pronta mas não implementado

---

## 🐛 Bugs conhecidos vs 💡 Melhorias

### Bugs (comportamento incorreto)

| # | Descrição | Arquivo | Severidade |
|---|---|---|---|
| B1 | Upload de arquivo no workspace usa `alert()` como fallback de limite — já **corrigido** em 22/03 | `TccSidebar.tsx` | ~~Alta~~ Resolvido |
| B2 | Exportação com popup bloqueado trava silenciosamente — já **corrigido** em 22/03 | `tcc/[id]/page.tsx` | ~~Alta~~ Resolvido |
| B3 | `ONBOARDING_STEP` hints no linter para `Menu`, `Check`, `PanelRightOpen` importados mas não usados no workspace | `tcc/[id]/page.tsx` | Baixa (hint, não erro) |
| B4 | Turnitin exibe valor estático (não é API real) — usuário pode interpretar como dado real | `TccSidebar.tsx` | Média — precisa disclaimer mais claro ou remoção para beta |
| B5 | `getDailyCount` usa `localStorage` — já **corrigido** em 06/05 via `/api/quota/me` | `tcc/[id]/page.tsx` | ~~Média~~ Resolvido |
| B6 | Sem proteção de rota no workspace — usuário pode acessar `/tcc/[id]` de outro usuário se souber o ID | `api/tcc/[id]/route.ts` | Alta — verificar se `userId` é checado em todos os métodos |

### Melhorias (não é bug, mas agrega valor)

| # | Descrição | Impacto |
|---|---|---|
| M1 | Mensagem de boas-vindas no workspace vazio — "Comece pedindo para a IA escrever a introdução do seu TCC" | Alto |
| M2 | Contador de palavras/caracteres no editor | Médio |
| M3 | Atalhos de teclado para ações rápidas (Ctrl+R = revisar, Ctrl+E = exportar) | Baixo |
| M4 | Tooltips nos botões de ação da toolbar | Baixo |
| M5 | Animação de entrada no workspace ao criar TCC novo | Baixo |
| M6 | Avatar/foto do usuário no nav rail | Baixo |

---

## 🚀 Entra no beta controlado

Tudo que está marcado como **concluído** acima está apto para beta. Resumindo o scope do beta:

- Cadastro e login (email/senha)
- Dashboard com gerenciamento de projetos
- Onboarding de 5 passos com contexto completo
- Workspace com editor, chat IA, autosave e toolbar de ações
- Planos FREE, PRO e VIP com limites aplicados
- Exportação PDF (com/sem marca d'água)
- Upload de referências

**Critério de entrada**: usuário consegue criar um TCC do zero, escrever com ajuda da IA e exportar o resultado — sem travar em nenhuma etapa crítica.

---

## ⏳ Fica para depois do beta

| Item | Motivo |
|---|---|
| Recuperação de senha | Não bloqueia o beta com usuários convidados |
| Confirmação de e-mail | Usuários do beta serão cadastrados manualmente |
| Rate limiting | Volume baixo no beta controlado |
| Progresso real do TCC | Estimativa atual serve para o beta |
| Histórico de versões | Autosave cobre a necessidade imediata |
| Modo escuro refinado | Beta provavelmente em modo claro |
| B5 (localStorage limit) | Resolvido via quota server-side em Redis + BFF `/api/quota/me` |

---

## ⚠️ Atenção antes de abrir para mais usuários (pós-beta)

1. **Bug B6 — Autorização no workspace**: confirmar que todas as rotas `/api/tcc/[id]/*` verificam que o TCC pertence ao usuário autenticado antes de expor dados ou aceitar mutações.
2. **Turnitin (B4)**: o valor exibido é estimado. Adicionar disclaimer explícito ou remover o componente antes de escalar.
3. **Rate limiting amplo**: estender quota/rate limit server-side para endpoints fora de `/api/chat` nas fases 5/6.
4. **Rate limiting**: implementar antes de abrir cadastro público.
