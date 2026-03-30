# Regras de IA para o Projeto Teseo

## Stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (primitivos em src/components/ui/)
- Prisma ORM + PostgreSQL
- NextAuth v5 (beta)
- Tiptap (editor rico)
- Framer Motion (animações)
- Gemini Flash (provider de IA)

## 1. ARQUITETURA — NUNCA DUPLIQUE

Antes de criar qualquer componente, verifique se já existe em:
- `src/components/ui/` — botões, cards, inputs, dialogs, tabs, progress
- `src/components/` — TccSidebar, AiActionToolbar, EditableRichText, RichEditor
- `src/lib/` — plan.ts, analytics.ts, gemini.ts, ai/provider.ts, agents/

Nunca crie um novo botão, input ou card do zero. Use os primitivos de `src/components/ui/`.

## 2. DESIGN SYSTEM

Cores (usar sempre via variável CSS ou classe Tailwind):
- Background principal: `#faf9f5` (bg-[#faf9f5])
- Background sutil: `#f3f1ea`
- Surface: `#ffffff`
- Surface quente: `#f6f3ed`
- Borda: `#e7e1d6`
- Texto primário: `#171717`
- Texto secundário: `#6b665f`
- Accent principal: `#c4663a` (brand-accent — terracota/clay)
- Accent hover: `#b85b31`
- Accent soft: `#e9d2c6`
- Sucesso: `#5f7a65`
- Aviso: `#ad7a2f`
- Danger: `#b4544d`

Regras visuais:
- NÃO use gradientes espalhafatosos, glassmorphism ou neon
- NÃO crie sombras pesadas — use `shadow-sm` no máximo
- Use espaçamento generoso (breathing room)
- Bordas arredondadas médias e consistentes (`rounded-lg` ou `rounded-xl`)
- Tipografia: Inter (sans) para corpo, Lora (serif) para headings editoriais

## 3. ROTAS E ARQUIVOS — ONDE FICA O QUÊ

Páginas do app:
- `/` → `src/app/page.tsx` (landing)
- `/dashboard` → `src/app/dashboard/page.tsx` (dashboard + modal de criação)
- `/tcc/[id]` → `src/app/tcc/[id]/page.tsx` (workspace — editor + chat IA)
- `/login` → `src/app/login/page.tsx`
- `/register` → `src/app/register/page.tsx`
- `/pricing` → `src/app/pricing/page.tsx`
- `/admin/users` → `src/app/admin/users/page.tsx`

APIs principais:
- `POST /api/chat` → geração de texto via IA (runTccWorkflow)
- `POST /api/tcc/[id]/ai-action` → ações da toolbar (revisar, abnt, citações)
- `GET|PUT|DELETE /api/tcc/[id]` → CRUD do TCC
- `POST /api/tcc/[id]/attachments` → upload de arquivos

Lógica de IA:
- Orquestrador: `src/lib/agents/aiox-integration.ts`
- Prompts das ações: `src/lib/agents/guardrails.ts`
- Provider de modelo: `src/lib/ai/provider.ts`
- System prompts dos agentes: `.codex/agents/redator-{free|pro|vip}.md`

## 4. PLANOS — FREE / PRO / VIP

A lógica de planos está centralizada em `src/lib/plan.ts`.
Não hardcode limites em componentes — sempre importe de plan.ts.

Resumo dos limites:
- FREE: 1 TCC, 3 mensagens/dia, 5 anexos, sem toolbar de IA
- PRO: 1 TCC, 50 mensagens/dia, 20 anexos, revisar gramatical
- VIP: 2 TCCs, ilimitado, 50 anexos, todas as ações

## 5. BANCO DE DADOS

Schema em `prisma/schema.prisma`. Modelos principais:
- `User` (id, email, plan, role)
- `Tcc` (id, userId, title, course, institution, workType, norma, deadline, objective, content)
- `Message` (id, tccId, role:'user'|'bot', content, agent)
- `Attachment` (id, tccId, fileName, fileUrl, fileSize, mimeType)

Após alterar o schema: `npm run db:migrate`

## 6. SEGURANÇA — OBRIGATÓRIO

- NUNCA exponha chaves de API no frontend (sem NEXT_PUBLIC_ para segredos)
- Toda rota de API deve chamar `auth()` e verificar `session.user.id`
- Todo acesso a TCC deve incluir `userId` no where do Prisma (nunca só o id)
- Mensagens POST só aceitam `role: "user"` — bot messages são server-side only
- Upload: validar MIME type + limite de 20MB antes de ler o arquivo

## 7. WORKFLOW ANTES DE ESCREVER CÓDIGO

1. Identifique quais componentes existentes serão reutilizados
2. Identifique quais libs/hooks já cobrem a necessidade (plan.ts, analytics.ts, etc.)
3. Só crie algo novo se realmente não existir
4. Mantenha server components onde não há interatividade
5. Client components apenas quando necessário (hooks, eventos, estado local)
6. Adicione `trackEvent()` para novos fluxos importantes

## 8. REFERÊNCIA RÁPIDA

Documento completo de navegação do projeto: `docs/MAPA-DO-PROJETO.md`
Status do produto e bugs conhecidos: `STATUS.md`
Arquitetura de IA: `docs/ai/rag/`
