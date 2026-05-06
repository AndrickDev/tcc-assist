# Smoke local — cut-over /api/chat → FastAPI

Validação ponta a ponta da fase 3 do roadmap (BL-010) antes de virar `USE_FASTAPI_AI=true` em produção.

## Pré-requisitos

- Docker + Docker Compose.
- `uv` instalado (gerencia Python no `services/ai`).
- `npm` (gerencia Next no `apps/web`).
- `GOOGLE_API_KEY` válido para Gemini API.

## 1. Subir Postgres + Redis

Da raiz do repo:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps  # ambos healthy
```

Tear down ao final: `docker compose -f docker-compose.dev.yml down -v` (`-v` apaga volume).

## 2. Aplicar schema do Prisma

```bash
cd apps/web
POSTGRES_URL="postgresql://tcc:tcc@localhost:5432/tcc?schema=public" \
  npx prisma db push
```

`db push` é idempotente; aplica o schema sem criar migration. Suficiente para smoke.

## 3. Subir FastAPI

Em outro terminal:

```bash
cd services/ai
export INTERNAL_JWT_SECRET="dev-secret-with-at-least-32-bytes-12345"
export GOOGLE_API_KEY="<sua-key>"
export REDIS_URL="redis://localhost:6379/0"
export POSTGRES_URL="postgresql://tcc:tcc@localhost:5432/tcc"
uv run uvicorn app.main:app --port 8000 --reload
```

Healthcheck: `curl http://localhost:8000/v1/health` → 200.

## 4. Subir Next com flag on

Em terceiro terminal:

```bash
cd apps/web
export USE_FASTAPI_AI=true
export AI_SERVICE_URL=http://localhost:8000
export INTERNAL_JWT_SECRET="dev-secret-with-at-least-32-bytes-12345"
export POSTGRES_URL="postgresql://tcc:tcc@localhost:5432/tcc?schema=public"
# Adicionais que o Next exige (NextAuth, Stripe, etc.) — manter os valores do .env.local atual.
npm run dev
```

## 5. Validações manuais

Login no `http://localhost:3000`. Crie um usuário FREE. Criar um TCC. Abrir o workspace.

| Caso | Esperado |
|---|---|
| FREE — enviar mensagem 1, 2, 3 | Cada uma retorna conteúdo Gemini. Contador "X de 3" no sidebar (se exibido). |
| FREE — 4ª mensagem | `LimitModal` abre antes de chamar `/api/chat`. Verificar log do FastAPI: nenhuma chamada de `consume` na 4ª. |
| F5 + recarregar workspace | Contador permanece (Redis, não localStorage). |
| Aba anônima do mesmo usuário | Mesmo gating (cross-browser). |
| Trocar plano para VIP via DevPlanSwitcher | Sem gate. Logs mostram `quota_consumed` mas `allowed=true, remaining=-1`. |
| Parar o FastAPI (`Ctrl+C`) e enviar | UI fail-open (permite envio); rota `/api/chat` retorna 503 `ai_provider_unavailable` mapeado pra "IA temporariamente indisponível". |
| Parar Redis (`docker stop tcc-redis-dev`) | `/api/chat` → 503 `quota_unavailable` mapeado pra "Serviço temporariamente indisponível". |

## 6. Teste flag off (rollback)

Reinicia Next sem `USE_FASTAPI_AI=true`:

```bash
cd apps/web
unset USE_FASTAPI_AI
npm run dev
```

Validar:
- `/api/chat` chama `runTccWorkflow` direto (Gemini via Next, sem FastAPI).
- Log `[api/chat] using fastapi` ausente.
- Comportamento legado preservado (gate por `prisma.message.count` server-side).

## 7. Critério de aprovação

Todos os casos da tabela acima passam → cut-over pronto pra produção.

## 8. Pós-aprovação

1. Setar `USE_FASTAPI_AI=true` em produção (Vercel + Fly.io conforme ADR-0007/decisões).
2. Monitorar 1–3 dias: latência, taxa de erro `/api/chat`, contador Redis, logs do FastAPI.
3. Se estável: avançar para T-E5 (cleanup do código legado).

## Limpeza

```bash
docker compose -f docker-compose.dev.yml down -v
```

Remove volumes — banco zerado.
