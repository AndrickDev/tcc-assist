# ADR-0007 — Monorepo com runtime split

- **Status:** Aceito
- **Data:** 2026-05-02
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, repo, devx

---

## Contexto

A ADR-0001 separou o serviço de IA em FastAPI dedicado, deployado independente do Next.js. Inicialmente o desenho colocou cada serviço em seu próprio repositório git (`tcc-assist` e `tcc-assist-ai`). Essa decisão tratava de runtime, não de organização de código-fonte.

Operando como solo dev no estágio de beta, dois repositórios introduziram atrito mensurável já na primeira semana:

- Cada feature que cruza Next ↔ FastAPI (rota nova, contrato JWT, schema RAG) viraria 2 PRs em 2 repos para entregar 1 capacidade de produto.
- Push em duplicidade: em 2026-05-01 o usuário ficou em dúvida sobre por que o gráfico de contribuições do GitHub não acendia, sintoma direto do overhead.
- Histórico, issues e tracking divididos entre dois locais.
- Codex CLI e revisão por Claude precisam carregar contextos disjuntos.

A separação funcional definida na ADR-0001 é por **runtime e deploy**, não por sistema de versionamento. Vercel, Fly.io, Render, Railway e GitHub Actions todos suportam deploy independente a partir de subdiretórios via `Root Directory` e `paths` filters.

## Decisão

Consolidar `tcc-assist` e `tcc-assist-ai` em um único repositório git (`tcc-assist`) com layout de monorepo:

```
tcc-assist/
├── apps/
│   └── web/                 (Next.js — antes na raiz)
├── services/
│   └── ai/                  (FastAPI — antes em tcc-assist-ai)
├── docs/                    (cross-cutting: ADRs, BACKLOG, runbooks)
├── AGENTS.md                (raiz, navegação)
├── STATUS.md
├── README.md
└── .github/workflows/
    ├── ci-web.yml           (paths: apps/web/** → typecheck + lint)
    └── ci-ai.yml            (paths: services/ai/** → ruff + mypy + pytest)
```

A separação de runtime continua intocada:

- **Vercel** deploya `apps/web/` (Root Directory ajustado na UI antes do próximo deploy).
- **FastAPI** deploya de `services/ai/` em provedor a definir (BL-007).
- Comunicação entre os dois continua via HTTP com JWT interno (ADR-0006).
- Schema dual-managed: Prisma em `apps/web/prisma/`, Alembic futuro em `services/ai/`.

A raiz não tem `package.json` nem `pyproject.toml`. Comandos rodam dentro do workspace correspondente:

- `cd apps/web && npm run ...`
- `cd services/ai && uv run ...`

Workspaces npm e ferramentas como Turborepo/Nx **não foram adotadas**. A complexidade adicional não se justifica para dois serviços e um único dev. Reavaliar quando houver um terceiro serviço ou pacote compartilhado de tipos.

## Consequências

### Positivas
- Commits atômicos cobrindo features cruzadas (rota nova FastAPI + BFF Next no mesmo commit).
- Único `git push` por dia de trabalho.
- Único gráfico de contribuições, único histórico, único tracking de issues.
- Codex e revisão Claude carregam contexto unificado, reduzindo retrabalho.
- ADRs e BACKLOG ficam ao lado dos serviços naturalmente.
- Reduz overhead operacional pra solo dev.

### Negativas
- Vercel exige configuração do Root Directory (ajuste pontual na UI, mas precisa lembrar).
- CI precisa de path filter pra evitar rodar Python em PR de Next e vice-versa. Padrão GitHub Actions resolve.
- `npm run` precisa rodar de `apps/web/`, não da raiz, salvo se workspaces forem adicionados depois. Custo trivial.
- Caso futuro de open-source de uma camada exigirá `git subtree split`. Risco aceitável dado o estágio.

### Neutras
- O nome do repo permanece `tcc-assist`. Nenhuma integração externa precisa ser ajustada.
- Histórico do `tcc-assist-ai` é raso (1 commit de bootstrap), copiado como conteúdo no commit de migração — sem `git subtree merge`. Perda de histórico irrelevante.

## Alternativas consideradas

**A. Manter dois repositórios separados.**
Rejeitada. Overhead operacional desproporcional ao estágio (solo dev, beta, sem usuários pagantes). Funcionaria em time grande com boundaries de squad; não funciona aqui.

**B. Monorepo com workspaces multi-linguagem (Turbo, Nx).**
Rejeitada agora. Workspaces npm não orquestram Python; tasks runners introduzem tooling sem ganho concreto pra dois serviços. Reavaliar quando houver um terceiro serviço ou um pacote compartilhado.

**C. Submodules git.**
Rejeitada. Submodules pioram experiência de solo dev (clone, pull, switch de branch, conflitos confusos) e não resolvem o problema-raiz, que é overhead de PRs cruzados.

## Notas de implementação

- Migração executada em uma única tarefa (BL-011), com commit isolado contendo movimentação de arquivos + atualização de AGENTS.md/STATUS.md + split do CI.
- Movimentação dentro de `tcc-assist` usa `git mv` (preserva histórico). Conteúdo de `tcc-assist-ai` é copiado como estado novo (1 commit raso, perda aceitável).
- Após validação local (`npm run typecheck` em `apps/web` e `uv run ruff/mypy/pytest` em `services/ai` verdes), commit + push.
- Ajuste manual (fora do escopo do Codex): atualizar **Root Directory** na Vercel pra `apps/web` antes do próximo deploy.
- Diretório `~/Desktop/tcc-assist-ai/` permanece como backup local até confirmar que a migração funcionou em produção; depois pode ser removido.

## Referências

- ADR-0001 — Separação do serviço de IA em FastAPI com RAG (escopo de runtime, não modificada por esta ADR).
- BL-011 — Migração de repos para monorepo (execução desta ADR).
