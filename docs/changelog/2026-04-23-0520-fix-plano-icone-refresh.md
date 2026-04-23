---
data: 2026-04-23 05:20
titulo: Fix de plano (ícone correto + atualização automática na sessão)
categoria: fix
commit: 8bdb890
autor: Andrick
status: deployed
---

# Fix de plano (ícone correto + atualização automática na sessão)

## Resumo
Corrigimos dois problemas relacionados à exibição e à atualização do plano do usuário: a coroa dourada aparecia mesmo para quem está no plano gratuito, e o plano ficava "preso" na sessão depois do login, não refletindo upgrades feitos no banco. Agora o ícone muda conforme o plano (FREE/PRO/VIP) e a sessão pega o plano novo sozinha em até 5 minutos (ou imediatamente se o usuário clicar em "Atualizar" na tela de Configurações).

## Motivação
Reportado pelo sócio:
1. "Fica aparecendo com coroa o do meu sócio mas tá escrito gratuito" — a tela de `/configuracoes` tinha uma `<Crown>` hard-coded ao lado do nome do plano, então mesmo alguém no plano FREE aparecia com a coroa dourada. Contradizia o badge do dashboard (que mostrava "Gratuito" sem coroa).
2. "O meu também mesmo estando logado com VIP tá aparecendo gratuito" — o callback `jwt` do NextAuth só preenchia o plano **no momento do login**. Depois disso, mesmo com upgrade no banco (via script admin ou Stripe webhook no futuro), o usuário só via o novo plano se deslogasse e logasse de novo. Era invisível pra qualquer um que não soubesse desse detalhe.

Pro beta com o Gabriel (sócio testando como VIP) e pra qualquer futura cobrança via Stripe, esse comportamento é bloqueador.

## O que mudou (técnico)

**UI (`src/app/configuracoes/page.tsx`):**
- Imports `Shield` e `Sparkles` de lucide-react.
- Ícone do plano agora é condicional: `VIP → Crown` (terracota), `PRO → Shield` (neutro), `FREE → Sparkles` (muted).
- Botão "Atualizar" discreto ao lado do plano, que chama `useSession().update()` — força o callback jwt a revalidar no banco.

**Backend (`src/lib/auth.ts`):**
- Callback `jwt` sobrescrito, mantendo `...authConfig.callbacks` pra não perder `session` e `authorized`.
- Comportamento:
  1. **Login inicial** (`user` definido): grava `id`, `role`, `plan` e `lastPlanRefresh` no token.
  2. **Refresh forçado** (`trigger === "update"`): re-lê `plan` e `role` do banco imediatamente.
  3. **Refresh automático**: se passaram mais de **5 minutos** desde a última leitura (`lastPlanRefresh`), refaz a query em segundo plano.
- Falhas de DB no refresh caem em `try/catch` e apenas logam — a sessão continua válida com o plano anterior em caso de problema.

**Trade-off aceito:** cada request que renova o JWT paga 1 query no Postgres no máximo a cada 5 minutos por usuário. Para o volume do beta (dezenas de usuários), o custo é desprezível. Se virar problema em escala, podemos usar cache em Redis ou reduzir o TTL de forma adaptativa.

## Como validar
Após deploy (2 min):

**Fluxo do sócio (quem já estava logado e teve upgrade):**
1. Gabriel continua logado na Vercel
2. Abrir `/configuracoes`
3. Clicar em **Atualizar** ao lado do plano
4. O selo deve passar de "Gratuito + Sparkles" pra "VIP + Crown" imediatamente
5. Todos os botões VIP (Norma ABNT, Citações, etc.) devem liberar no workspace

**Fluxo automático (quem não clica em nada):**
1. Esperar ~5 minutos navegando normalmente
2. O plano atualiza sozinho no próximo refresh de JWT
3. Vai refletir no badge do dashboard, no selo de `/configuracoes` e no AiActionToolbar

**Visual do badge:**
- FREE: ícone ✨ (Sparkles), texto "Gratuito"
- PRO: ícone 🛡️ (Shield), texto "PRO"
- VIP: ícone 👑 (Crown, terracota), texto "VIP"

## Impacto
- **Usuário:** mudanças de plano agora ficam visíveis em até 5 minutos sem precisar relogar. Upgrade pago (futuro via Stripe) vai aparecer quase instantaneamente.
- **Admin/dev:** usar o script `scripts/upgrade-partner.mjs` pra dar VIP ao sócio passa a refletir no app dele automaticamente.
- **Custo:** cada usuário ativo gera no máximo 1 query adicional a cada 5 min (SELECT simples por `id`).
- **Segurança:** nenhuma mudança nas permissões. O refresh pega apenas `plan` e `role` — mesmos campos que já eram gravados no login.
- **Breaking change:** não.

## Próximos passos
- Quando a integração com Stripe webhook for ativa, garantir que ela atualiza a linha `User.plan` no Postgres — a partir daí, a sessão reflete em ≤ 5 min sem nenhuma ação adicional.
- Considerar no futuro: sistema de notificação ("Seu plano foi atualizado pra PRO — clique pra aplicar agora") como alternativa ao refresh silencioso.

## Referências
- Commit: `8bdb890` (`git show 8bdb890`)
- Relacionados:
  - [Correção do fluxo de login/cadastro](2026-04-23-0215-fix-fluxo-login-cadastro.md)
