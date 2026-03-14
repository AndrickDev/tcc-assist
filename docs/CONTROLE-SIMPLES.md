# TCC-ASSIST - Guia de Controle Simples

## 1. Monitoramento Financeiro (Stripe)
Toda a gestão de pagamentos, assinaturas e faturamento é feita pelo Stripe Dashboard.
[Link: Stripe Subscriptions](https://dashboard.stripe.com/subscriptions)

## 2. Monitoramento Técnico (Vercel Postgres)
Para verificar uso abusivo ou métricas em tempo real, use o Query Editor no painel da Vercel.
As queries estão disponíveis em [VERCEL-QUERY.md](./VERCEL-QUERY.md).

## 3. Regras de Negócio Automáticas
O código já implementa os limites baseados no plano:
- **FREE**: 1 TCC ativo + Limite de 1 página/dia.
- **PRO**: 1 TCC ativo + Ilimitado.
- **VIP**: 2 TCCs ativos + Ilimitado.

*Documento gerado para substituir o PRODUCT_SPEC.md legado.*
