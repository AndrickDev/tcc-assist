# CONTROLE TOTAL (roda no Vercel Dashboard → Postgres → Query)

## Relatório Diários (todos usuários)
```sql
SELECT 
  u.email, u.plan,
  COUNT(DISTINCT t.id) as tccs_draft,
  COUNT(CASE WHEN m.createdAt >= CURRENT_DATE THEN 1 END) as paginas_hoje,
  AVG((m.metadata->>'plagiarism')::numeric) as plágio_medio
FROM "User" u 
LEFT JOIN "Tcc" t ON u.id = t."userId" AND t.status = 'IN_PROGRESS'
LEFT JOIN "Message" m ON t.id = m."tccId" AND m.role = 'bot'
GROUP BY u.id, u.email, u.plan
ORDER BY paginas_hoje DESC;
```

## Usuários FREE abusando
```sql
SELECT u.email, COUNT(m.id) as paginas_hoje
FROM "User" u 
JOIN "Tcc" t ON u.id = t."userId"
JOIN "Message" m ON t.id = m."tccId"
WHERE u.plan = 'FREE' AND m.role = 'bot' AND m."createdAt" >= CURRENT_DATE
GROUP BY u.id, u.email HAVING COUNT(m.id) > 1;
```

## Revenue Stripe (abra Stripe Dashboard)
- **Subscriptions**: veja quem paga PRO/VIP [Link](https://dashboard.stripe.com/subscriptions)
- **Customers**: histórico pagamentos [Link](https://dashboard.stripe.com/customers)
