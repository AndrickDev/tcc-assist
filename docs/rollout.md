# Runbook de rollout — cut-over `/api/chat` para FastAPI

Procedimento de ativação em produção da fase 3 (BL-010). Issue de tracking: [#14](https://github.com/AndrickDev/tcc-assist/issues/14).

ADRs relacionados: 0001 (split FastAPI), 0005 (quota Redis), 0006 (JWT interno), BL-006 (Upstash), BL-007 (Fly.io).

---

## 1. Pré-requisitos locais

```bash
# Fly CLI
brew install flyctl
# ou: curl -L https://fly.io/install.sh | sh

flyctl auth login   # abre browser
flyctl auth whoami  # confirma usuário
```

---

## 2. Provisionar Redis (Upstash)

1. Criar conta em https://upstash.com (free tier cobre 10k req/dia).
2. **Create Database**:
   - Nome: `teseo-quota`
   - Tipo: Regional (mais simples) ou Global.
   - Região: `us-east-1` (mais próxima do GRU em latência REST). Confirmar.
   - TLS: enabled.
3. Copiar a connection string TCP (formato `rediss://default:<token>@<endpoint>:6379`).

Guardar como `REDIS_URL` para usar no Fly.io.

---

## 3. Provisionar FastAPI (Fly.io)

### 3.1 Criar o app

```bash
cd /Users/andrick/Desktop/tcc-assist/services/ai
flyctl apps create teseo-ai   # ou outro nome único
```

### 3.2 Ajustar `fly.toml`

Editar a linha `app = "PLACEHOLDER-AJUSTAR"` para o nome criado.

### 3.3 Configurar secrets

```bash
flyctl secrets set \
  INTERNAL_JWT_SECRET="<gerar via: openssl rand -hex 32>" \
  GOOGLE_API_KEY="<chave Gemini>" \
  REDIS_URL="<connection string Upstash>" \
  POSTGRES_URL="<connection string Postgres do Prisma com permissão de SELECT em Tcc/Message/Reference>"
```

**IMPORTANTE:** o `INTERNAL_JWT_SECRET` deve ser **idêntico** ao configurado depois no Vercel.

### 3.4 Deploy

```bash
flyctl deploy --remote-only
```

Aguardar build + push + start. Output deve mostrar a URL pública (ex: `https://teseo-ai.fly.dev`).

### 3.5 Healthcheck

```bash
curl https://teseo-ai.fly.dev/v1/health
```

Esperado: `{"status":"ok"}` ou similar com 200.

Se 502/timeout: `flyctl logs` pra investigar.

---

## 4. Configurar Vercel

### 4.1 Setar envs em Production

Via dashboard Vercel ou CLI:

```bash
cd /Users/andrick/Desktop/tcc-assist/apps/web
vercel env add INTERNAL_JWT_SECRET production    # mesmo valor do Fly.io
vercel env add AI_SERVICE_URL production         # https://teseo-ai.fly.dev (sem trailing slash)
# Ainda NÃO setar USE_FASTAPI_AI=true.
```

### 4.2 Redeploy sem flag

```bash
vercel --prod
```

Confirmar que /api/chat continua funcionando via runTccWorkflow legado (smoke rápido em prod com flag off).

---

## 5. Ativar a flag

### 5.1 Setar `USE_FASTAPI_AI`

```bash
vercel env add USE_FASTAPI_AI production   # valor: true
vercel --prod
```

### 5.2 Smoke pós-deploy

Logado em produção:

```bash
# Substituir <cookie-de-sessao> e <tcc-id-real>
curl -s https://teseo.app.br/api/quota/me \
  -H "Cookie: next-auth.session-token=<cookie>" | jq

curl -s https://teseo.app.br/api/chat \
  -X POST \
  -H "Cookie: next-auth.session-token=<cookie>" \
  -H "Content-Type: application/json" \
  -d '{"tccId":"<tcc-id>","message":"Escreva uma intro de teste"}' | jq
```

Esperado:
- `/api/quota/me` retorna `{used, limit, remaining, resetAt}`.
- `/api/chat` retorna `{id, content, agent, timestamp}`.
- Logs Fly.io mostram `chat_started` → `chat_quota_consumed` → `chat_generated` → `chat_completed`.
- Logs Vercel mostram `[api/chat] using fastapi`.

### 5.3 Validar gating em conta FREE

Subir em conta FREE até a 3ª mensagem; 4ª deve retornar 429 do FastAPI e UI deve abrir LimitModal.

---

## 6. Monitoramento (1–3 dias)

Status em 2026-05-13: rollout ativado em produção com `USE_FASTAPI_AI=true`.
Smoke pós-deploy aprovado: `/api/quota/me` 200, `/api/chat` 200 e conta FREE bloqueada via LimitModal após atingir a quota.

| Métrica | Onde | Alerta |
|---|---|---|
| Latência p95 `/api/chat` | Vercel Analytics | > 30s |
| Taxa de erro `/api/chat` | Vercel logs | > 1% |
| Logs `[api/chat] fastapi failure` | Vercel logs | qualquer ocorrência |
| Logs `chat_failed` | Fly.io | > 1/min |
| Healthcheck `/v1/health` | Fly.io | falhas consecutivas |
| Contador Redis `quota:*` | Upstash console | crescimento conforme uso |

---

## 7. Rollback

Se latência p95 ou erro > 1%, ou se houver regressão visível:

```bash
vercel env rm USE_FASTAPI_AI production
# OU: vercel env add USE_FASTAPI_AI production  → false
vercel --prod
```

Comportamento volta ao legado. FastAPI fica no ar mas ocioso (Fly.io `auto_stop_machines = "stop"` desliga após inatividade).

Investigar root cause em logs antes de tentar de novo.

---

## 8. Pós-validação (após 1–3 dias estáveis)

Próxima tarefa: **T-E5 cleanup**.

Remover:
- `apps/web/src/lib/agents/aiox-integration.ts`
- `apps/web/src/lib/gemini.ts`
- `apps/web/src/lib/ai/provider.ts`
- `.codex/agents/redator-{free,pro,vip}.md`
- Branch legado em `apps/web/src/app/api/chat/route.ts`
- Variável `USE_FASTAPI_AI` (sempre on, sem fallback)
- Função `useFastApiAi()` em `apps/web/src/lib/feature-flags.ts`

Atualizar `STATUS.md` fase 3 → `concluído` e fechar BL-010 / Issue #14.

---

## Custos estimados (mensal)

- Fly.io: ~US$5 (VM 1 cpu / 512 MB sempre quente em GRU).
- Configuração atual usa `min_machines_running = 0` para reduzir custo enquanto o projeto valida demanda. Trade-off: primeiro request após ocioso pode ter cold start.
- Upstash: free tier (até 10k req/dia). Migrar para `pay-as-you-go` quando ultrapassar.
- Vercel: plano atual sem custo adicional.
- Gemini API: uso já existente, sem mudança.
