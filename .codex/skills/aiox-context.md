# TCC Assist Context

Este é o contexto principal do projeto TCC Assist (Teseo) para ser utilizado pelo Codex CLI.

## Estrutura Atual e Status
- O projeto é um SaaS para estudantes desenvolverem seus TCCs com auxílio de inteligência artificial.
- O front-end usa Next.js 15 (App Router), Tailwind CSS, Framer Motion e Lucide React.
- O back-end e banco de dados usam Next.js API Routes e Prisma.
- O estado de tarefas, bugs e features futuras está documentado no arquivo `STATUS.md` na raiz do projeto. **Sempre consulte o STATUS.md antes de planejar novas tarefas.**
- O projeto usa um Design System customizado (`--brand-accent`, `--brand-surface`, etc) implementado em `index.css`. Não use Tailwind colors genéricas.

## Últimas Implementações (Abril 2026)
- **Referências OpenAlex**: Foi corrigido e aprimorado o módulo de busca de referências científicas reais. A busca foi transferida para `title_and_abstract.search` para evitar que artigos irrelevantes apareçam, e foi adicionado um campo de busca manual no painel lateral (`ReferencesDrawer.tsx`), já que termos complexos muitas vezes retornam 0 resultados.

## Como atuar a partir daqui
- Leia o arquivo `STATUS.md` na raiz para entender o que falta fazer antes do Beta e o que está no Backlog.
- Siga as diretrizes de código listadas no arquivo `AGENTS.md`.
- Rode o servidor via `npm run dev` e aplique alterações preferencialmente em escopos pequenos, revisando sempre através do linter `npm run lint`.
