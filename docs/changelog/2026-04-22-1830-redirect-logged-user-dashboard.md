---
data: 2026-04-22 18:30
titulo: Redirecionar usuário logado da landing para o dashboard
categoria: feat
commit: 1ed6f2a
autor: Andrick
status: deployed
---

# Redirecionar usuário logado da landing para o dashboard

## Resumo
Quem já está logado na plataforma não vê mais a landing page ao acessar `teseo.app/`. O sistema reconhece a sessão e envia direto para o dashboard de projetos.

## Motivação
Antes, mesmo com login ativo, o usuário caía na página institucional (hero, preços, FAQ) e precisava clicar em "Entrar" de novo pra chegar na área dele. Fluxo estranho, especialmente para usuários recorrentes que só querem abrir seus TCCs. Feedback direto do sócio sinalizou isso como ruído no onboarding.

## O que mudou (técnico)
- `src/app/page.tsx` — página raiz virou Server Component `async`; chama `auth()` no servidor e, se houver sessão, executa `redirect("/dashboard")` antes de renderizar qualquer markup da landing.

## Como validar
1. Abrir `https://teseo.vercel.app/` (ou domínio de produção) em uma aba normal com sessão ativa — deve cair direto em `/dashboard`.
2. Abrir o mesmo link em aba anônima / deslogado — deve ver a landing normal (hero, features, preços, FAQ).
3. Fazer logout pelo botão da sidebar — deve voltar pra landing.
4. Fazer login novo — após autenticar, o NextAuth redireciona pra `/`, e o redirect server-side imediatamente leva pro dashboard.

## Impacto
- **Usuário:** um clique a menos pra quem já tem conta. Landing continua 100% funcional pra visitantes não logados e campanhas de marketing.
- **Segurança:** nenhuma mudança de permissão — a proteção do dashboard continua igual.
- **Performance:** uma chamada a `auth()` no render da landing. Custo desprezível, mesmo no plano gratuito da Vercel.
- **Breaking change:** não.

## Próximos passos
Avaliar se a mesma lógica faz sentido nas páginas `/pricing` e `/legal/*` (provavelmente não — essas são referências públicas que usuário logado também consulta). Deixar como está até surgir demanda concreta.

## Referências
- Commit: `1ed6f2a` (`git show 1ed6f2a`)
- Push em `main` → deploy automático na Vercel.
