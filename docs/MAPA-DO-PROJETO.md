# Teseo — Mapa Completo do Projeto
> "Onde está o quê e como tudo se conecta"
> Atualizado em: 2026-03-22

---

## VISÃO GERAL EM UMA LINHA

```
Landing → Login/Cadastro → Dashboard → [Criar TCC] → Workspace (editor + IA + sidebar)
```

O usuário entra pela landing, se cadastra, cai no dashboard, cria um TCC
(onboarding de 5 passos em modal), e abre o workspace onde escreve com ajuda da IA.

---

## 1. ROTAS DO APP (o que o usuário vê)

| Rota | Arquivo | O que é |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page pública |
| `/login` | `src/app/login/page.tsx` | Tela de login (email/senha + Google) |
| `/register` | `src/app/register/page.tsx` | Tela de cadastro |
| `/dashboard` | `src/app/dashboard/page.tsx` | **Dashboard principal** — lista TCCs, modal de criação |
| `/dashboard/new-tcc` | `src/app/dashboard/new-tcc/page.tsx` | Só redireciona para `/dashboard` (legado) |
| `/tcc/[id]` | `src/app/tcc/[id]/page.tsx` | **Workspace** — editor + chat IA + sidebar |
| `/pricing` | `src/app/pricing/page.tsx` | Página de planos |
| `/admin/users` | `src/app/admin/users/page.tsx` | Painel admin (só ADMIN) |

---

## 2. ROTAS DE API (o que o servidor faz)

### Autenticação
| Rota | Arquivo | O que faz |
|---|---|---|
| `POST /api/register` | `src/app/api/register/route.ts` | Cria usuário com bcrypt |
| `ANY /api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth — login, sessão, OAuth |

### TCC (CRUD)
| Rota | Arquivo | O que faz |
|---|---|---|
| `GET /api/tcc` | `src/app/api/tcc/route.ts` | Lista TCCs do usuário logado |
| `POST /api/tcc` | `src/app/api/tcc/route.ts` | Cria TCC (checa slot limit do plano) |
| `GET /api/tcc/[id]` | `src/app/api/tcc/[id]/route.ts` | Busca metadados de 1 TCC |
| `PUT /api/tcc/[id]` | `src/app/api/tcc/[id]/route.ts` | Salva conteúdo do editor (autosave) |
| `DELETE /api/tcc/[id]` | `src/app/api/tcc/[id]/route.ts` | Deleta TCC + cascade |

### Workspace — Mensagens e IA
| Rota | Arquivo | O que faz |
|---|---|---|
| `POST /api/chat` | `src/app/api/chat/route.ts` | **Geração principal** — recebe mensagem, chama IA, salva resposta |
| `GET /api/tcc/[id]/messages` | `src/app/api/tcc/[id]/messages/route.ts` | Lista histórico do chat |
| `POST /api/tcc/[id]/messages` | `src/app/api/tcc/[id]/messages/route.ts` | Salva mensagem do usuário (só role: user) |
| `PUT /api/tcc/[id]/content` | `src/app/api/tcc/[id]/content/route.ts` | Edita conteúdo de uma mensagem bot |
| `POST /api/tcc/[id]/ai-action` | `src/app/api/tcc/[id]/ai-action/route.ts` | Toolbar de ações IA (revisar, abnt, citações, próximo passo) |
| `GET /api/tcc/[id]/stats` | `src/app/api/tcc/[id]/stats/route.ts` | Progresso, plágio, autoria, páginas |

### Attachments
| Rota | Arquivo | O que faz |
|---|---|---|
| `GET /api/tcc/[id]/attachments` | `src/app/api/tcc/[id]/attachments/route.ts` | Lista arquivos do TCC |
| `POST /api/tcc/[id]/attachments` | `src/app/api/tcc/[id]/attachments/route.ts` | Faz upload (max 20MB, PDF/DOC/DOCX) → salva em `/public/uploads/` |

### Pagamentos
| Rota | Arquivo | O que faz |
|---|---|---|
| `POST /api/stripe/checkout` | `src/app/api/stripe/checkout/route.ts` | Cria sessão de checkout Stripe |
| `POST /api/stripe/webhook` | `src/app/api/stripe/webhook/route.ts` | Recebe evento Stripe, atualiza plano do usuário |

### Admin
| Rota | Arquivo | O que faz |
|---|---|---|
| `GET /api/admin/users` | `src/app/api/admin/users/route.ts` | Lista todos usuários + métricas |
| `POST /api/admin/users/[id]/plan` | `src/app/api/admin/users/[id]/plan/route.ts` | Muda plano de um usuário |
| `POST /api/admin/users/[id]/reset-limits` | `src/app/api/admin/users/[id]/reset-limits/route.ts` | Reseta limite diário de mensagens |

---

## 3. COMPONENTES PRINCIPAIS

### Workspace
| Componente | Arquivo | O que é |
|---|---|---|
| **Página workspace** | `src/app/tcc/[id]/page.tsx` | Monta tudo — estado, chat, editor, sidebar |
| **Editor rico** | `src/components/EditableRichText.tsx` | Tiptap com toolbar, autosave 2s, inserção de sugestão |
| **Editor somente leitura** | `src/components/RichEditor.tsx` | Versão sem edição (legado/export) |
| **Toolbar de IA** | `src/components/AiActionToolbar.tsx` | Botões revisar/abnt/citações/próximo passo |
| **Sidebar** | `src/components/TccSidebar.tsx` | Progresso, turnitin, páginas, upload de anexos |

### Dashboard
| Componente | Arquivo | O que é |
|---|---|---|
| **Página dashboard** | `src/app/dashboard/page.tsx` | Grid de cards + NewTccModal embutido |
| *(sem componentes externos)* | — | Dashboard e modal são self-contained na page.tsx |

### Landing
| Componente | Arquivo | O que é |
|---|---|---|
| Hero | `src/components/landing/HeroSection.tsx` | Seção principal da landing |
| Sobre | `src/components/landing/AboutSection.tsx` | Features e proposta de valor |
| Workflow | `src/components/landing/WorkflowSection.tsx` | Como funciona |
| Preços | `src/components/landing/PricingSection.tsx` + `PricingCard.tsx` | Cards de planos |
| FAQ | `src/components/landing/FAQSection.tsx` | Perguntas frequentes |
| Header landing | `src/components/landing/LandingHeader.tsx` | Nav da landing |
| Footer | `src/components/landing/LandingFooter.tsx` | Rodapé |

### UI (shadcn/base)
Ficam em `src/components/ui/` — button, card, dialog, input, textarea, tabs, progress, etc.
**Não edite esses diretamente.** Use-os como primitivos.

### Outros
| Componente | Arquivo | O que é |
|---|---|---|
| DevPlanSwitcher | `src/components/DevPlanSwitcher.tsx` | Switcher de plano só em dev |
| Logo / BrandIcon | `src/components/brand/` | Logo SVG do Teseo |
| Header | `src/components/Header.tsx` | Header genérico (pouco usado) |

---

## 4. CAMADA DE IA — COMO FUNCIONA

```
Usuário digita mensagem no workspace
    ↓
POST /api/chat
    ↓
runTccWorkflow() — src/lib/agents/aiox-integration.ts
    ↓
1. Checa limite diário (contagem de mensagens bot no DB)
2. Seleciona agente: redator-free / redator-pro / redator-vip
3. Carrega system prompt do arquivo .codex/agents/{agente}.md
4. Busca metadados do TCC (título, curso, norma, objetivo)
5. Busca histórico:
   FREE → nenhum
   PRO  → últimas 3 mensagens
   VIP  → últimas 8 mensagens
6. Monta prompt final: systemPrompt + metadados + histórico + guardrails + mensagem
7. Chama generateAIContent() → callGemini() → Gemini Flash API
8. Salva resposta como Message{role:'bot'} no banco
9. Retorna para o frontend
```

### Ações da toolbar (revisar, abnt, citações, próximo passo)
```
Usuário clica botão na AiActionToolbar
    ↓
POST /api/tcc/[id]/ai-action
    ↓
buildActionPrompt() — src/lib/agents/guardrails.ts
    ↓ (monta prompt específico por ação + guardrails)
generateAIContent() → Gemini
    ↓
Retorna texto direto — NÃO salva no banco
    ↓
Frontend insere no editor
```

### Arquivos chave da IA
| Arquivo | Responsabilidade |
|---|---|
| `src/lib/gemini.ts` | Chamada HTTP para Gemini API + config por plano (tokens, temperatura) |
| `src/lib/ai/provider.ts` | Abstração do provider — troque de Gemini para GPT aqui |
| `src/lib/agents/aiox-integration.ts` | **Orquestrador** — toda a lógica de contexto, limite, agente |
| `src/lib/agents/guardrails.ts` | Prompts das ações da toolbar + guardrails de saída |
| `.codex/agents/redator-free.md` | System prompt do agente FREE |
| `.codex/agents/redator-pro.md` | System prompt do agente PRO |
| `.codex/agents/redator-vip.md` | System prompt do agente VIP |

---

## 5. SISTEMA DE PLANOS

**Arquivo central:** `src/lib/plan.ts`

```
FREE  → 1 TCC, 3 mensagens/dia, 5 anexos, sem ações de toolbar
PRO   → 1 TCC, 50 mensagens/dia, 20 anexos, revisar gramatical
VIP   → 2 TCCs, ilimitado, 50 anexos, todas as ações + geração premium
```

| O que muda por plano | Onde está |
|---|---|
| Limite de TCCs (slots) | `src/lib/plan.ts → getSlotLimit()` |
| Limite de mensagens/dia | `src/lib/plan.ts → getDailyMessageLimit()` |
| Limite de anexos | `src/lib/plan.ts → getAttachmentLimit()` |
| Tokens e temperatura do Gemini | `src/lib/gemini.ts → PLAN_CONFIGS` |
| System prompt do agente | `.codex/agents/redator-{free|pro|vip}.md` |
| Histórico injetado no prompt | `src/lib/agents/aiox-integration.ts` (seção 3.5) |
| Ações bloqueadas | `src/app/api/tcc/[id]/ai-action/route.ts` |
| Watermark no PDF | `src/app/tcc/[id]/page.tsx` (exportação) |
| Hook de plano no frontend | `src/hooks/useUserPlan.ts` |

---

## 6. BANCO DE DADOS (Prisma + PostgreSQL)

**Schema:** `prisma/schema.prisma`

```
User
 ├── id, email, name, password, role(USER|ADMIN), plan(FREE|PRO|VIP)
 ├── planExpiresAt
 ├── → tccs[]
 ├── → accounts[] (OAuth)
 └── → sessions[]

Tcc
 ├── id, userId, title, course, institution
 ├── workType, norma, deadline, objective
 ├── content (Text — conteúdo do editor)
 ├── status (IN_PROGRESS | COMPLETED | ARCHIVED)
 ├── → messages[]
 └── → attachments[]

Message
 ├── id, tccId, role(user|bot), content(Text)
 └── agent (redator-free | redator-pro | redator-vip | null)

Attachment
 ├── id, tccId, fileName, fileUrl, fileSize, mimeType
 └── (arquivo físico em /public/uploads/{userId}/{tccId}/)
```

---

## 7. AUTENTICAÇÃO

| Arquivo | O que faz |
|---|---|
| `src/lib/auth.ts` | Configuração completa do NextAuth (com Prisma, bcrypt, callbacks) |
| `src/lib/auth.config.ts` | Config edge-compatible (sem Prisma — usada no middleware) |
| `src/middleware.ts` | Protege `/dashboard` e `/tcc/*` — redireciona para `/login` se não logado |

**Fluxo de login:**
- Credentials: email + senha → bcrypt.compare → session JWT
- Google OAuth: via GoogleProvider → PrismaAdapter
- Session carrega: `id`, `role`, `plan` no token JWT

---

## 8. ANALYTICS / TRACKING

**Arquivo:** `src/lib/analytics.ts`

17 eventos tipados. Em dev → `console.debug`. Em prod → `console.info` (JSON).
Para conectar a PostHog/Mixpanel/Amplitude: substituir o branch de produção.

| Grupo | Eventos |
|---|---|
| Onboarding | `ONBOARDING_STEP`, `TCC_CREATED`, `TCC_DELETED` |
| Workspace | `WORKSPACE_OPEN`, `MANUAL_SAVE_TCC`, `INSERT_SUGGESTION_DOCUMENT`, `AI_SUGGESTION_REGENERATE` |
| IA | `AI_ACTION_CLICK`, `AI_ACTION_BLOCK_PLAN`, `AI_ACTION_SUCCESS`, `AI_ACTION_ERROR`, `AI_PANEL_TOGGLE_NEXT_STEP` |
| Monetização | `UPGRADE_MODAL_SHOWN`, `UPGRADE_CTA_CLICK`, `LIMIT_MODAL_SHOWN`, `EXPORT_CLICK` |
| Engajamento | `TURNITIN_INFO_HOVER` |

---

## 9. VARIÁVEIS DE AMBIENTE

**Arquivo de referência:** `.env.example`

| Variável | Onde é usada | Obrigatória |
|---|---|---|
| `GOOGLE_API_KEY` | `src/lib/gemini.ts` — chama Gemini | **Sim** |
| `POSTGRES_URL` | `prisma/schema.prisma` — banco de dados | **Sim** |
| `AUTH_SECRET` ou `NEXTAUTH_SECRET` | `src/lib/auth.ts` | **Sim** |
| `NEXTAUTH_URL` | NextAuth | **Sim** |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | OAuth Google | Se usar Google |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts` | Para billing |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | Para billing |
| `STRIPE_PRICE_PRO` + `STRIPE_PRICE_VIP` | `src/lib/stripe.ts` | Para billing |
| `NEXT_PUBLIC_APP_URL` | Stripe redirect URLs | Para billing |
| `NEXT_PUBLIC_TESEO_DEV_PLAN` | Dev plan switcher | Não (só dev) |

---

## 10. GUIA RÁPIDO — "ONDE MEXO PARA MUDAR X?"

| Quero mudar... | Arquivo |
|---|---|
| Texto da landing page | `src/components/landing/HeroSection.tsx` (e siblings) |
| Layout do dashboard | `src/app/dashboard/page.tsx` |
| Passos do onboarding (modal de criação) | `src/app/dashboard/page.tsx` → componente `NewTccModal` |
| Comportamento do editor (autosave, inserção) | `src/components/EditableRichText.tsx` |
| Comportamento da IA no chat | `src/lib/agents/aiox-integration.ts` |
| Tom / instruções do agente FREE | `.codex/agents/redator-free.md` → seção `## System Prompt` |
| Tom / instruções do agente PRO | `.codex/agents/redator-pro.md` → seção `## System Prompt` |
| Tom / instruções do agente VIP | `.codex/agents/redator-vip.md` → seção `## System Prompt` |
| Guardrails / prompts das ações da toolbar | `src/lib/agents/guardrails.ts` |
| Limites de plano (slots, mensagens, anexos) | `src/lib/plan.ts` |
| Tokens e temperatura por plano | `src/lib/gemini.ts` → `PLAN_CONFIGS` |
| Trocar Gemini por outro modelo | `src/lib/ai/provider.ts` + `src/lib/gemini.ts` |
| Sidebar do workspace (progresso, anexos) | `src/components/TccSidebar.tsx` |
| Botões da toolbar de IA | `src/components/AiActionToolbar.tsx` |
| Exportação PDF | `src/app/tcc/[id]/page.tsx` → função de export |
| Preços e planos na landing | `src/components/landing/PricingSection.tsx` + `PricingCard.tsx` |
| Checkout Stripe | `src/app/api/stripe/checkout/route.ts` |
| O que acontece quando o pagamento conclui | `src/app/api/stripe/webhook/route.ts` |
| Schema do banco | `prisma/schema.prisma` → depois `npm run db:migrate` |
| Adicionar um novo evento de analytics | `src/lib/analytics.ts` → adicionar ao type `EventName` |
| Proteger uma nova rota | `src/middleware.ts` → adicionar ao matcher |
| Cores e tokens de design | `src/app/globals.css` (variáveis CSS `--color-brand-*`) |
| Painel de administração | `src/app/admin/users/page.tsx` |

---

## 11. FLUXO COMPLETO EM DIAGRAMA

```
[/]  Landing
  └── CTA "Começar" → [/register]
        └── POST /api/register → cria User no banco
              └── [/login] → POST /api/auth → sessão JWT
                    └── [/dashboard]
                          ├── GET /api/tcc → lista projetos do usuário
                          ├── [clica "Novo TCC"] → NewTccModal (5 passos)
                          │     └── POST /api/tcc → cria Tcc no banco
                          │           └── redirect → [/tcc/[id]]
                          └── [clica projeto existente] → [/tcc/[id]]

[/tcc/[id]]  Workspace
  ├── GET /api/tcc/[id] → metadados (título, norma, curso...)
  ├── GET /api/tcc/[id]/messages → histórico do chat
  ├── GET /api/tcc/[id]/stats → progresso, turnitin, páginas
  ├── GET /api/tcc/[id]/attachments → lista arquivos
  │
  ├── [usuário digita mensagem]
  │     ├── POST /api/tcc/[id]/messages (role:user)
  │     └── POST /api/chat → runTccWorkflow → Gemini → salva bot message
  │           └── resposta exibida como card no chat
  │                 └── [clica "Inserir"] → EditableRichText insere no documento
  │
  ├── [editor com conteúdo] → autosave 2s → PUT /api/tcc/[id]
  │
  ├── [clica ação toolbar] → POST /api/tcc/[id]/ai-action → Gemini
  │     └── resultado inserido no editor
  │
  └── [clica exportar] → html2canvas + jsPDF → download PDF
        (FREE: com marca d'água / PRO+VIP: limpo)
```

---

## 12. O QUE AINDA NÃO ESTÁ IMPLEMENTADO

| Feature | Status | Arquivo quando implementar |
|---|---|---|
| Recuperação de senha | Não implementado | Nova rota `/api/auth/reset-password` + email |
| Confirmação de e-mail | Não implementado | NextAuth `sendVerificationRequest` |
| Rate limiting nas APIs | Não implementado | `src/middleware.ts` ou upstash/redis |
| Analytics provider real | Só console.info | `src/lib/analytics.ts` → branch prod |
| Ingestão de PDFs para IA | Não implementado | `src/lib/ingestion.ts` (novo) |
| GPT como provider alternativo | Stub pronto | `src/lib/ai/provider.ts` → `callOpenAI()` |
| Uploads privados (não em /public) | Risco existente | Migrar para Vercel Blob com signed URLs |
