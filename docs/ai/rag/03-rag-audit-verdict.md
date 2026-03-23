# 03 — Veredito da Auditoria RAG

## Classificação final

> **O Teseo usa Context Injection com Prompt Engineering estruturado.**
> **Não usa RAG.**

---

## Nível de confiança

**Alto.** A auditoria varreu 100% dos arquivos relevantes:
- Todas as dependências em `package.json`
- Todo o diretório `src/lib/`
- Todas as rotas de API relacionadas a IA
- O schema Prisma completo
- Os arquivos `.codex/agents/` e `.codex/workflows/`

Nenhuma evidência de RAG foi encontrada em nenhum desses locais.

---

## Evidências concretas — o que FOI encontrado

| Evidência | Arquivo | Interpretação |
|---|---|---|
| `callGemini(prompt)` — chamada direta com prompt string | `src/lib/gemini.ts:49` | Geração pura, sem retrieval |
| `prisma.message.findMany({ take: 3 })` (PRO) | `src/lib/agents/aiox-integration.ts:51` | Context injection de histórico recente |
| `prisma.message.findMany()` sem limit (VIP) | `src/lib/agents/aiox-integration.ts:58` | Context injection de histórico completo |
| `fs.readFileSync(.codex/agents/{id}.md)` | `src/lib/agents/aiox-integration.ts:37` | System prompts como arquivos estáticos |
| `buildActionPrompt(action, plan, text, context)` | `src/lib/agents/guardrails.ts:1` | Prompt engineering para ações in-loco |
| `Attachment` model com `fileUrl` (Vercel Blob) | `prisma/schema.prisma:101` | Arquivos salvos, nunca lidos pela IA |

---

## Evidências concretas — o que NÃO foi encontrado

| Componente RAG | Procurado em | Resultado |
|---|---|---|
| Embeddings (qualquer provider) | `package.json`, `src/` inteiro | **Ausente** |
| pgvector / Qdrant / Pinecone / Weaviate / Chroma | `package.json`, `schema.prisma`, `src/` | **Ausente** |
| Chunking de documentos | `src/lib/`, `src/app/api/` | **Ausente** |
| Pipeline de ingestão de PDFs | `src/app/api/tcc/[id]/attachments/`, `src/lib/` | **Ausente** |
| Retrieval top-k por similaridade | Todo o projeto | **Ausente** |
| Reranking | Todo o projeto | **Ausente** |
| Qualquer chamada à API de embeddings do Gemini ou OpenAI | `src/lib/gemini.ts`, `src/lib/ai/` | **Ausente** |

---

## Justificativa técnica

### Por que não é RAG

RAG exige, por definição, uma etapa de **retrieval separada da geração**, onde:
1. Um documento ou base de conhecimento é fragmentado e indexado com representações vetoriais.
2. No momento da geração, uma query é usada para recuperar os fragmentos mais semanticamente
   relevantes.
3. Os fragmentos recuperados são inseridos no prompt.

No Teseo, o que acontece é diferente:
- O "contexto" é simplesmente as mensagens anteriores do próprio usuário, buscadas por
  ordenação cronológica (`orderBy: { createdAt: 'asc' }`), não por relevância semântica.
- Os arquivos de referência (PDFs) nunca são lidos pela IA — apenas armazenados.
- Não existe índice, não existe embedding, não existe busca por similaridade.

### Por que não é Pseudo-RAG ou RAG parcial

Pseudo-RAG ou RAG parcial normalmente implica que existe algum componente de retrieval,
mesmo que imperfeito — por exemplo, busca por palavras-chave (BM25) sem embeddings,
ou um índice simples sem reranking.

No Teseo não existe sequer isso. A seleção de contexto é puramente cronológica (as N últimas
mensagens), o que é uma estratégia válida mas não tem nenhuma característica de retrieval.

### O que existe é válido para o estágio atual

Context injection com histórico de mensagens é uma abordagem eficaz, simples e de baixo custo
para o caso de uso atual do Teseo: um usuário trabalhando em um único TCC de forma linear.
O modelo tem acesso ao trabalho já produzido e consegue manter consistência.

A ausência de RAG não é um defeito de produto — é uma decisão arquitetural adequada ao
estágio beta, onde a complexidade de uma pipeline RAG adicionaria custo e risco sem
benefício claro imediato.

---

## Nota sobre o workflow YAML

O arquivo `.codex/workflows/tcc-generation.yaml` descreve um workflow em 3 fases, incluindo
uma fase de qualidade com `anti-plagio` e `calculate-progress`. Esses agentes existem como
arquivos `.md` em `.codex/agents/` mas **não são invocados pelo código de produção**.

`runTccWorkflow` em `aiox-integration.ts` implementa apenas as fases 1 e 2 do YAML.
A fase 3 é código morto neste momento. Isso não é problema — o YAML serve como documentação
de intenção de produto, não como spec executável.

---

_Próximo: [04 — Gap Analysis](04-gap-analysis.md)_
