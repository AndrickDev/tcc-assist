# 05 — Runbook: como operar, depurar e evoluir a pipeline de IA

## Para quem é este documento

Um desenvolvedor que não participou da criação original do Teseo e precisa:
- Entender onde a IA é chamada
- Depurar uma resposta ruim do modelo
- Verificar se o contexto está chegando corretamente ao prompt
- Evoluir a pipeline para suportar RAG
- Monitorar saúde da integração em produção

---

## Mapa de arquivos críticos

```
src/
├── lib/
│   ├── gemini.ts                    # Chamada HTTP para o Gemini API
│   ├── ai/
│   │   └── provider.ts              # Ponto central de chamada — sempre edite aqui ao trocar provider
│   ├── agents/
│   │   ├── aiox-integration.ts      # Orquestrador principal do workflow de chat
│   │   └── guardrails.ts            # Montagem de prompts para as AI Actions
│   └── analytics.ts                 # Tracking de eventos — adicione logs de IA aqui
│
├── app/api/
│   ├── chat/route.ts                # Endpoint POST /api/chat
│   └── tcc/[id]/
│       ├── route.ts                 # GET / PUT / DELETE do TCC
│       ├── ai-action/route.ts       # POST /api/tcc/:id/ai-action (toolbar)
│       ├── messages/route.ts        # GET / POST histórico de mensagens
│       └── attachments/route.ts     # GET / POST de anexos
│
.codex/
├── agents/
│   ├── redator-free.md              # System prompt do agente FREE
│   ├── redator-pro.md               # System prompt do agente PRO
│   └── redator-vip.md               # System prompt do agente VIP
└── workflows/
    └── tcc-generation.yaml          # Documento de design (não executado diretamente)
```

---

## Como verificar o fluxo de geração

### 1. Verificar se o Gemini está respondendo

```bash
# Teste rápido da API key
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Responda apenas: ok"}]}]}'
```

Resposta esperada: `{"candidates":[{"content":{"parts":[{"text":"ok"}]...`

---

### 2. Verificar se o prompt está sendo montado corretamente

Em `src/lib/agents/aiox-integration.ts`, `runTccWorkflow`, adicione temporariamente:

```typescript
console.log('=== PROMPT ENVIADO AO GEMINI ===')
console.log(generationPrompt)
console.log('=== FIM DO PROMPT ===')
```

Antes da linha `let generatedContent = await generateAIContent(...)`.

Isso imprimirá o prompt completo nos logs do servidor (Next.js dev console ou Vercel logs).

---

### 3. Verificar o contexto injetado por plano

No mesmo arquivo, o `contextStr` é montado assim:

```typescript
// PRO: últimas 3 mensagens
const lastMessages = await prisma.message.findMany({
  where: { tccId },
  orderBy: { createdAt: 'desc' },
  take: 3
})

// VIP: todo o histórico
const allMessages = await prisma.message.findMany({
  where: { tccId },
  orderBy: { createdAt: 'asc' }
})
```

Se o contexto parecer vazio ou errado:
- Verifique se `tccId` está correto na chamada
- Use Prisma Studio (`npm run db:studio`) para inspecionar as mensagens da tabela `Message`

---

### 4. Verificar os system prompts dos agentes

Os arquivos em `.codex/agents/redator-{free,pro,vip}.md` são carregados em runtime.
Se o comportamento do modelo mudou inesperadamente, verifique se esses arquivos foram
alterados. O código extrai apenas o conteúdo após `## System Prompt`:

```typescript
agentSystemPrompt = agentFile.split('## System Prompt')[1]?.trim() || ''
```

Se `## System Prompt` não existir no arquivo, o agente fallback para:
`'Você é um redator de TCC acadêmico.'`

---

### 5. Verificar limites diários

O limite é calculado por contagem de mensagens `role: bot` no dia corrente:

```typescript
const dailyUsage = await prisma.message.count({
  where: {
    tccId,
    role: 'bot',
    createdAt: { gte: today }  // today = hoje às 00:00:00
  }
})
```

Para resetar manualmente (admin):
```
POST /api/admin/users/{userId}/reset-limits
```

Para inspecionar via Prisma Studio: filtrar tabela `Message` por `tccId` e data.

---

### 6. Verificar AI Actions (toolbar)

O fluxo de AI Actions em `/api/tcc/[id]/ai-action` não persiste o resultado
na tabela `Message`. Se uma ação não aparecer no editor, o problema está no frontend
(componente `AiActionToolbar`), não no backend.

Para depurar o prompt de ação, em `src/lib/agents/guardrails.ts` adicione:
```typescript
console.log('Action prompt:', prompt)
```

---

## Como alterar o provider de IA

O único ponto a editar é `src/lib/ai/provider.ts`:

```typescript
// Para adicionar OpenAI:
if (provider === 'gpt') {
  return callOpenAI(prompt, options)  // implemente callOpenAI em src/lib/openai.ts
}
```

Não altere `aiox-integration.ts` ou `guardrails.ts` para trocar de provider.
Eles chamam sempre `generateAIContent(prompt, 'gemini')` e continuarão funcionando
se o provider default mudar.

---

## Como evoluir para RAG

Sequência recomendada de implementação (da [Gap Analysis](04-gap-analysis.md)):

### Passo 1 — Habilitar pgvector no PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Migration Prisma:
```prisma
model DocumentChunk {
  id           String   @id @default(cuid())
  attachmentId String
  tccId        String
  userId       String
  text         String   @db.Text
  embedding    Unsupported("vector(768)")
  pageNumber   Int?
  chunkIndex   Int
  createdAt    DateTime @default(now())

  attachment   Attachment @relation(fields: [attachmentId], references: [id], onDelete: Cascade)
}
```

### Passo 2 — Adicionar ingestão de PDF após upload

Em `src/app/api/tcc/[id]/attachments/route.ts`, após salvar o arquivo no Vercel Blob,
acionar um job de ingestão:

```typescript
// Após: await prisma.attachment.create(...)
await ingestAttachment(savedAttachment.id, tccId, session.user.id, fileUrl)
```

Implementar `ingestAttachment` em `src/lib/ingestion.ts`:
1. Download do arquivo via `fetch(fileUrl)`
2. Extração de texto com `pdf-parse`
3. Chunking por parágrafo com overlap de 1 parágrafo
4. Embedding de cada chunk via Gemini `text-embedding-004`
5. Insert em `DocumentChunk` com vetor

### Passo 3 — Retrieval no workflow

Em `src/lib/agents/aiox-integration.ts`, após montar `contextStr`, adicionar:

```typescript
// Gerar embedding da query do usuário
const queryEmbedding = await embedText(message)

// Buscar top-5 chunks mais relevantes (filtrado por tccId + userId)
const relevantChunks = await retrieveTopK(queryEmbedding, tccId, userId, 5)

if (relevantChunks.length > 0) {
  contextStr += `\n[REFERÊNCIAS RELEVANTES DOS SEUS DOCUMENTOS]:\n`
  contextStr += relevantChunks.map(c => c.text).join('\n\n')
}
```

---

## Como instrumentar observabilidade

O `trackEvent` em `src/lib/analytics.ts` aceita propriedades arbitrárias.
Para logar eventos de IA detalhados, adicione eventos novos ao type `EventName` e chame:

```typescript
trackEvent('AI_GENERATION_COMPLETE', {
  tccId,
  agentId,
  plan,
  promptTokens: estimatedTokens(generationPrompt),
  responseLength: finalContent.length,
  durationMs: Date.now() - startTime
})
```

Para conectar a um provider real, substitua o branch de produção em `analytics.ts`:
```typescript
// Exemplo com PostHog:
posthog.capture(eventName, payload.properties)
```

---

## Variáveis de ambiente necessárias

| Variável | Onde usar | Obrigatória |
|---|---|---|
| `GOOGLE_API_KEY` | `src/lib/gemini.ts:50` | Sim |
| `POSTGRES_URL` | `prisma/schema.prisma` | Sim |
| `NEXTAUTH_SECRET` | NextAuth | Sim |
| `NEXTAUTH_URL` | NextAuth | Sim |
| `NEXT_PUBLIC_TESEO_DEV_PLAN` | Dev plan switcher | Não (dev only) |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts` | Para billing |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | Para billing |

---

_Fim da documentação de IA do Teseo._
_Para revisitar o veredito: [03 — Veredito](03-rag-audit-verdict.md)_
