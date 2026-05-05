# ADR-0004 — Stripe subscription

- **Status:** Aceito
- **Data:** 2026-05-02
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, monetizacao, stripe, billing

---

## Contexto

Hoje o Stripe usa `mode: 'payment'` no checkout. O usuário paga uma vez e o webhook trata
`checkout.session.completed`, lê `metadata.userId` e `metadata.plan`, atualiza `User.plan` e calcula
`planExpiresAt` manualmente como `now + 365 dias`.

Esse desenho tem limitações estruturais para um SaaS:

- Não há renovação automática.
- Não há cancelamento de assinatura.
- Não há prorate.
- Não há dunning para tentativa de recuperação de pagamento.
- Cliente paga uma vez e vira "PRO/VIP por 1 ano", sem cobrança recorrente.
- Replay do webhook reaplica a mutação porque não existe idempotência (B5).

Esse modelo não sustenta monetização recorrente nem métricas financeiras básicas. Também aumenta o
risco operacional: um evento Stripe reentregue pode reprocessar plano sem controle explícito.

## Decisão

Migrar para **Stripe Checkout com `mode: 'subscription'`** usando prices recorrentes.

Periodicidade inicial: **mensal**. Plano anual fica como item secundário do mesmo Product no Stripe,
com a mesma lógica de plano e price diferente. Valores finais de preço ficam como TBD de produto,
não desta ADR.

**Eventos a tratar no webhook:**

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Idempotência:**

Criar tabela `processed_stripe_events` no schema Prisma:

- `id` PK.
- `event_id` UNIQUE.
- `event_type`.
- `processed_at`.

O webhook deve checar `event_id` antes de aplicar qualquer mutação. Se o evento já foi processado,
a reentrega vira no-op e responde sucesso.

**Mapeamento Subscription -> User.plan:**

- `subscription.status = active`: usuário recebe o plano da subscription (`PRO` ou `VIP`).
- `subscription.status = past_due`: plano permanece ativo, mas `subscription_status` sinaliza risco
  de cobrança.
- `subscription.status = canceled`: usuário rebaixa para `FREE` no fim do período pago.

**Schema novo em `User` (migration Prisma futura):**

- `subscription_id` string, FK lógica para Stripe.
- `subscription_status` enum: `active`, `past_due`, `canceled`, `none`.
- `current_period_end` DateTime, substitui `planExpiresAt` no fluxo principal.
- `planExpiresAt` permanece durante transição por compatibilidade e será removido depois.

## Consequências

### Positivas
- Monetização recorrente e sustentável.
- Rebaixamento automático em falha de pagamento fica possível via eventos Stripe.
- Idempotência encerra B5 quando o cut-over for implementado.
- Usa webhooks padrão do Stripe, bem documentados e testáveis com Stripe CLI.
- Métricas financeiras como churn e MRR ficam triviais de derivar.

### Negativas
- Webhook fica mais complexo: cinco eventos principais em vez de um.
- Teste end-to-end exige Stripe CLI ou ambiente de sandbox.
- Política de graça em `past_due` precisa ser decidida.
- Downgrade no meio do período exige decisão de UX: rebaixar imediatamente ou no fim do período
  pago.

### Neutras
- Nomes dos planos (`PRO`, `VIP`) permanecem.
- Fluxo visual do usuário muda pouco: ainda recebe URL de checkout, mas o modo da sessão muda.
- Stripe permanece no Next.js (`apps/web`); o serviço FastAPI não participa do billing.

## Alternativas consideradas

**A. Manter `mode: 'payment'` + cron de expiração.**
Rejeitada. É frágil, exige worker próprio, não trata renovação automática e não cobre reembolso,
falha de pagamento ou cancelamento de forma nativa.

**B. Stripe Tax + Subscriptions com Stripe Billing Portal.**
Aceita como evolução, não como decisão agora. Adiciona complexidade sem ganho imediato no Brasil.
Reavaliar quando houver volume financeiro ou necessidade fiscal mais clara.

**C. Lemon Squeezy / Paddle como Merchant of Record.**
Rejeitada agora. Aumenta lock-in, tende a cobrar taxas maiores e tem ferramental menor para o estágio
atual. Reavaliar somente se houver necessidade fiscal internacional.

**D. Stack própria de billing.**
Rejeitada. Stripe já resolve checkout, recorrência, dunning, eventos, assinatura e auditoria melhor
do que uma implementação própria neste estágio.

## Notas de implementação

O cut-over fica para uma tarefa futura. Passos previstos:

1. Criar Products e prices recorrentes no Stripe Dashboard. Valores finais são TBD de produto.
2. Criar migration Prisma adicionando `subscription_id`, `subscription_status` e
   `current_period_end` em `User`.
3. Criar tabela `processed_stripe_events` via Prisma.
4. Reescrever `apps/web/src/app/api/stripe/checkout/route.ts` para usar `mode: 'subscription'` e o
   novo price recorrente.
5. Reescrever `apps/web/src/app/api/stripe/webhook/route.ts` com `switch` por evento e check de
   idempotência.
6. Durante o cut-over, aceitar ambos os modos: usuários antigos com `mode: 'payment'` migram quando
   renovarem.

Política de graça em `past_due` fica como TBD da implementação. Sugestão inicial: 3 dias de retry
automático do Stripe, depois `canceled`.

## Gatilhos pra reavaliar

- Receita acima de US$5k/mês ou mais de 100 assinantes ativos: avaliar Stripe Tax e Billing Portal
  completo.
- Necessidade de cobrança em moedas além de USD/BRL: reavaliar Stripe versus Paddle/Lemon Squeezy.
- Churn voluntário sustentado acima de 5% ao mês: reavaliar UX de downgrade e cancelamento.

## Referências

- ADR-0001 — Separação do serviço de IA em FastAPI com RAG; Stripe permanece no Next.js.
- ADR-0007 — Monorepo; `apps/web/` contém o código Stripe.
- AGENTS.md §7, B5 — Webhook Stripe sem idempotência, endereçado por esta ADR.

