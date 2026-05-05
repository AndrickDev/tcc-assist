# ADR-0005 — Quota e rate limit em Redis

- **Status:** Aceito
- **Data:** 2026-05-02
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, quota, redis, rate-limit

---

## Contexto

Hoje a quota diária de mensagens IA está fragmentada:

- Frontend (`apps/web/src/app/tcc/[id]/page.tsx`) conta em `localStorage`, com chave diária por
  usuário/plano. Isso é bypassável por DevTools, aba anônima ou navegador novo (B3).
- `/api/chat` reconta via `prisma.message.count({ role: 'bot' })` dentro de
  `apps/web/src/lib/agents/aiox-integration.ts`.
- `/api/gerar-tcc` e `/api/tcc/[id]/ai-action` não contam uso de IA (B4).

Sem fonte única de verdade, nenhum desses contadores é confiável. A UI pode exibir um número que o
backend não respeita; o backend só protege uma rota; e rotas mais caras, como geração de capítulo e
ações inline, escapam da quota.

Para alimentar o cut-over das rotas de IA para o FastAPI, precisamos de um serviço central de quota:

- Sub-50ms na decisão de permitir/bloquear.
- Atômico sob concorrência.
- Resistente a abuso trivial.
- Com a mesma lógica para `chat`, `generate` e `action`.

## Decisão

Implementar quota e rate limit em **Redis**, hospedados no serviço FastAPI (`services/ai/`).

O provedor Redis fica TBD entre Upstash e Vercel KV, a ser decidido em BL-006. Critérios já
conhecidos:

- Upstash: REST nativo, free tier de 10k requests/dia e latência regional.
- Vercel KV: mesma conta da Vercel e integração operacional mais simples.

Default operacional até a decisão formal: **Upstash**.

**Esquema de chave:**

- `quota:{userId}:{YYYY-MM-DD}` — contador inteiro de unidades consumidas no dia.
- TTL: 48 horas, dando margem para diferenças entre UTC e America/Sao_Paulo.

**Janela:**

- Fixed daily window.
- Reset à meia-noite UTC.
- Sliding window fica como evolução se houver bypass ou confusão relevante por timezone.

**Operação atômica:**

- `INCRBY weight` + `EXPIRE 48h` via pipeline.
- Lua script fica como evolução se corrida real for medida em produção.

**Contrato Python no FastAPI:**

```python
consume(
    user_id: str,
    scope: Literal["chat", "generate", "action"],
    weight: int,
    plan_limit: int,
) -> ConsumeResult
```

`ConsumeResult`:

```python
{
    "allowed": bool,
    "remaining": int,
    "reset_at": datetime,
    "reason": str | None,
}
```

**Pesos por escopo:**

- `chat`: `weight = 1`.
- `action`: `weight = 1`.
- `generate`: `weight = 3`.

Esses pesos são estimativas iniciais e devem ser ajustados com dados reais. VIP tem limite infinito:
`consume()` sempre retorna `allowed = true`, mas ainda incrementa o contador para observabilidade.

**Endpoint HTTP:**

- `GET /v1/quota/me` retorna o estado atual da quota do usuário autenticado.
- A UI passa a mostrar restante consultando esse endpoint via BFF, sem confiar em `localStorage`.

## Política em falha

Redis indisponível em produção: **fail-closed**.

- Retorna HTTP 503.
- Mensagem ao usuário: "Servico temporariamente indisponivel. Tente em instantes.".
- Justificativa: fail-open vira buraco de quota e pode queimar cota Gemini sem teto.

Redis indisponível em desenvolvimento: **fail-open** com `warn` no log.

- Justificativa: conveniência local não justifica bloquear desenvolvimento.

Toggle via env:

- `QUOTA_FAIL_MODE=closed|open`.
- Default em produção: `closed`.

## Consequências

### Positivas
- Encerra B3 e B4 quando o cut-over for implementado.
- Quota deixa de ser bypassável por client-side state.
- UI ganha endpoint direto para mostrar restante.
- `chat`, `generate` e `action` passam a usar a mesma fonte de verdade.
- Adicionar nova rota de IA passa a ser simples: chamar `consume()` antes da chamada à Gemini.

### Negativas
- Adiciona uma dependência externa (Redis).
- Custo inicial tende a ser quase zero, mas escala com volume de uso.
- Uma nova credencial precisa ser gerenciada com segurança.
- Fail-closed pode bloquear IA temporariamente se Redis cair em produção.

### Neutras
- Redis substitui `prisma.message.count` como fonte de quota quando a lógica migrar para FastAPI.
- Prisma continua responsável pelo histórico de mensagens, não por contagem operacional.
- A decisão não define o provedor Redis final; isso permanece em BL-006.

## Alternativas consideradas

**A. Contagem em Postgres com `UPDATE` atômico.**
Rejeitada. Introduz lock de linha em caminho quente, aumenta contenção com queries de produto e não é
ideal para decisão sub-50ms sob escala horizontal.

**B. Contagem em memória no FastAPI.**
Rejeitada. Não funciona com mais de uma instância: escala horizontal vira inconsistência de quota.

**C. Manter `prisma.message.count`.**
Rejeitada. Só conta o que persiste como mensagem; falhas de Gemini não contam; `generate` e `action`
escapam; e a query tende a ficar lenta em produção.

**D. DynamoDB ou outro KV proprietário.**
Rejeitada agora. É overkill para o estágio atual e adiciona superfície operacional maior do que
Redis.

## Notas de implementação

Módulo no FastAPI: `services/ai/app/quota/`.

- `quota/redis_client.py`: factory de conexão com retry e timeout.
- `quota/service.py`: contrato `consume()` e `get_state()`.
- `quota/exceptions.py`: `QuotaExceeded`, `QuotaBackendUnavailable`.

Pseudocódigo de uso:

```python
result = await quota.consume(user_id, scope, weight, plan_limit)
if not result.allowed:
    raise QuotaExceeded(result.reason)
log.info("quota_consumed", allowed=result.allowed, remaining=result.remaining)
response = await gemini.generate(prompt)
return response
```

Logging via `structlog` em toda chamada:

- `latency_ms`.
- `allowed`.
- `remaining`.
- `scope`.
- `plan`.
- `weight`.

Endpoint `/v1/quota/me`:

- Rota rápida, com lookup único no Redis.
- Não é pública: consome JWT interno definido na ADR-0006.

Env vars:

- Criar `REDIS_URL` em `.env.example` dos dois workspaces quando a implementação for feita.
- `services/ai` usa `REDIS_URL` para falar com Redis.
- `apps/web` expõe quota à UI via BFF chamando `/v1/quota/me`, sem acesso direto do browser ao Redis.

## Gatilhos pra reavaliar

- Mais de 1k `consume()`/segundo sustentados: medir latência p99 e considerar Lua script para reduzir
  round-trips.
- Bypass medido, como usuários criando contas para resetar quota: considerar contagem por device
  fingerprint ou IP no mesmo Redis.
- Mudança de janela de cobrança, como limite por hora: reavaliar fixed window versus sliding window.

## Referências

- ADR-0001 — Quota e rate limit ficam no FastAPI como consequência da separação de IA.
- ADR-0006 — JWT interno (a escrever em BL-005), exigido para `GET /v1/quota/me`.
- BL-006 — Decidir provedor Redis (Upstash vs Vercel KV).
- AGENTS.md §7, B3 e B4 — Quota client-side e rotas IA sem rate limit, endereçadas por esta ADR.

