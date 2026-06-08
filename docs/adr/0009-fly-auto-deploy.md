# ADR-0009 — Fly auto-deploy do FastAPI via GitHub Actions

- **Status:** Aceito
- **Data:** 2026-06-07
- **Decisor:** Andrick (solo dev)
- **Tags:** ops, ci/cd, fastapi, fly

---

## Contexto

Até 2026-06-04 o serviço FastAPI em `services/ai/` era deployado **manualmente** com
`flyctl deploy` rodado da máquina local. Resultado observado em 2026-06-04: prod estava em
Fly `v5` desde 2026-05-13 enquanto `main` já tinha 17 dias de commits adiante (T-F1, T-E5,
toda Phase 4 RAG). A divergência só ficou visível no canary T-F1 quando o endpoint
`/v1/actions/*` retornou 404 — código estava em main mas não em prod.

Custo do problema:
- Drift silencioso entre código revisado e código rodando.
- Debug enganoso (eu suspeitei de prefixo do router antes de descobrir que o motivo era
  imagem antiga).
- Single point of failure: precisa do solo dev na máquina certa com `flyctl` logado.

## Decisão

Adicionar GitHub Actions que faz `flyctl deploy --remote-only` toda vez que `services/ai/**`
muda em `main` (incluindo o próprio arquivo do workflow para permitir auto-validação).

**Arquivo:** `.github/workflows/fly-deploy.yml`.

**Gatilhos:**

- `push` em `main` com mudança em `services/ai/**` ou `.github/workflows/fly-deploy.yml`.
- `workflow_dispatch` para deploy manual da UI do GitHub Actions.

**Mecânica:**

- `superfly/flyctl-actions/setup-flyctl@master` instala o CLI.
- `flyctl deploy --remote-only` constrói no builder hospedado da Fly e atualiza as máquinas
  da app `teseo-ai` definida em `services/ai/fly.toml`.
- `concurrency.group=fly-deploy-ai` + `cancel-in-progress=false` evita race entre dois
  pushes seguidos sem matar deploy em andamento.

**Credenciais:**

- Secret `FLY_API_TOKEN` no GitHub. Token criado uma vez via `flyctl tokens create deploy
  -a teseo-ai` (escopo mínimo de deploy).

## Consequências

### Positivas

- Cada merge em `main` que toca o serviço de IA vira release Fly automaticamente. Drift como
  o de 2026-06-04 deixa de acontecer.
- Histórico de deploys fica refletido no GitHub (Actions tab) + Fly releases.
- Solo dev não precisa lembrar de rodar `flyctl deploy` após cada PR.

### Negativas

- Custo extra de minutos GitHub Actions por deploy (~2-3 min cada). No volume atual
  (poucos PRs/semana) cabe no free tier.
- Build remoto via Fly builder roda fora da máquina local — tempo de iteração para
  deploy de hotfix sobe ~1-2 min em relação a `flyctl deploy` local com cache.
- Se o token expira ou é revogado, deploys silenciosamente falham até alguém olhar o
  Actions tab.

### Neutras

- Vercel já fazia auto-deploy via git integration. Esta ADR só alinha o Fly ao mesmo
  modelo.
- Migrations Alembic continuam manuais (fora do escopo desta ADR — ver follow-up).

## Alternativas consideradas

**A. Manter deploy manual com pré-merge checklist.**
Rejeitada. Foi o que vinha em vigor; falhou. Solo dev esquece.

**B. `release_command` no `fly.toml` chamando `flyctl deploy` quando outras coisas mudam.**
Rejeitada. Não faz sentido; `release_command` roda *dentro* do deploy, não dispara deploy.

**C. CI-controled deploy with `needs: ci-ai` workflow_run.**
Adiada. Branch protection no main já exige CI verde antes do merge. O deploy assume CI ok.
Se virar problema (PR mergeado com CI vermelho), adiciono `needs` depois.

**D. Vercel-only host para FastAPI (Edge runtime / Vercel Functions).**
Rejeitada. ADR-0007 fixou Fly. Mudança de host fica fora do escopo desta ADR.

## Follow-ups

- **Alembic auto-migration.** Hoje a migration roda manualmente via `flyctl ssh console`.
  Decidir entre: (a) `release_command` no `fly.toml` chamando `alembic upgrade head` antes
  do machine start; (b) job separado no workflow rodando antes do `flyctl deploy`.
- **Vercel CD endurecido.** Vercel atualmente segue auto-deploy via git integration. Não
  documentado em ADR; criar ADR-0010 se virar fonte de bug.
- **Rotação de token.** `FLY_API_TOKEN` no GitHub não tem expiry padrão; agendar rotação
  semestral.

## Referências

- ADR-0001 — separação FastAPI + RAG.
- ADR-0007 — Fly.io como host (VM 256MB).
- Incidente 2026-06-04: prod Fly v5 ficou 17 dias atrás de main; descoberto via canary T-F1.
