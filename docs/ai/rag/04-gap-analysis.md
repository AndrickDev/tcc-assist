# 04 — Gap Analysis: o que falta para um RAG real

> Esta análise parte do pressuposto de que você decidiu evoluir a arquitetura atual
> para um RAG de produção. Ela é pragmática: lista apenas o que tem impacto real,
> sem overengineering.

---

## Por que considerar RAG no futuro do Teseo

O caso mais claro seria: **o usuário envia PDFs de referência e quer que a IA use
o conteúdo dessas referências ao gerar o texto.**

Hoje os PDFs são armazenados mas a IA os ignora completamente. Se o usuário enviar
um artigo científico como referência e pedir "use este artigo na introdução", o Teseo
não consegue fazer isso. Com RAG, poderia.

Outros casos possíveis no futuro:
- Base de normas ABNT indexada e consultável
- Templates de TCC por curso/faculdade recuperáveis por similaridade
- Histórico de projetos anteriores como base de conhecimento pessoal

---

## Gaps prioritários (alta prioridade)

### GAP-01 — Ingestão e parsing de PDFs

**O que falta:** os arquivos da tabela `Attachment` (armazenados no Vercel Blob)
nunca são lidos. Falta uma etapa de extração de texto dos PDFs após o upload.

**O que seria necessário:**
- Biblioteca de parsing: `pdf-parse`, `pdfjs-dist`, ou chamada a uma API de extração
- Rota ou job acionado após upload bem-sucedido
- Texto extraído salvo em nova coluna ou tabela separada

**Complexidade:** baixa-média. O maior custo é decidir onde rodar (serverless tem
limite de tempo, PDFs grandes podem exceder).

**Impacto para o usuário:** alto — a maior frustração potencial do produto atual.

---

### GAP-02 — Chunking do texto extraído

**O que falta:** mesmo com texto extraído, um PDF de 80 páginas não cabe em um único
contexto. É necessário fragmentar em chunks antes de indexar.

**O que seria necessário:**
- Estratégia de chunking: por parágrafo, por N tokens com overlap, ou por seção
- Para TCCs acadêmicos, chunking por seção semântica (abstract, referências, corpo)
  tende a funcionar melhor que chunking por tamanho fixo
- Metadados por chunk: `attachmentId`, `tccId`, `userId`, `pageNumber`, `sectionTitle`

**Complexidade:** média. A estratégia de chunking afeta diretamente a qualidade
do retrieval.

---

### GAP-03 — Embeddings

**O que falta:** representação vetorial de cada chunk para busca por similaridade.

**Opções disponíveis:**
- Gemini Embeddings API (`models/text-embedding-004`) — já usa Gemini, zero novo vendor
- OpenAI `text-embedding-3-small` — barato, boa qualidade
- Voyage AI `voyage-3-lite` — especializado em RAG acadêmico

**O que seria necessário:**
- Chamada à API de embeddings após o chunking
- Vetor de 256–1536 dimensões por chunk
- Armazenamento em banco vetorial (ver GAP-04)

**Complexidade:** baixa, uma vez que o banco vetorial estiver configurado.

---

### GAP-04 — Banco vetorial (vector store)

**O que falta:** repositório que suporte busca por similaridade (cosine distance ou
produto interno).

**Opções recomendadas para o stack atual (PostgreSQL/Vercel):**

| Opção | Prós | Contras |
|---|---|---|
| **pgvector** (extensão PostgreSQL) | zero novo serviço, mesmo Postgres atual | requer migração de schema + `HNSW` index |
| **Supabase** (inclui pgvector) | gerenciado, boa DX | troca de provider de DB |
| **Pinecone** | serverless, fácil | novo vendor, custo por uso |
| **Qdrant Cloud** | self-hostável, bom free tier | latência de rede extra |

**Recomendação para o Teseo:** `pgvector` na instância PostgreSQL existente.
Zero vendor novo, sem mudança de stack, migração simples.

**Complexidade:** média. Requer extensão habilitada no Postgres e schema migration.

---

### GAP-05 — Retrieval top-k no momento da geração

**O que falta:** substituir (ou complementar) a injeção cronológica de mensagens
por uma busca semântica nos chunks indexados.

**O que seria necessário:**
- Gerar embedding da query do usuário no momento da chamada
- Buscar top-k chunks mais similares no banco vetorial (tipicamente k=3 a 5)
- Filtrar por `tccId` e `userId` para garantir isolamento multi-tenant
- Injetar os chunks recuperados no prompt como contexto de referência

**Complexidade:** média-alta. Esta é a etapa que transforma a arquitetura em RAG real.

---

## Gaps de média prioridade

### GAP-06 — Metadados por chunk

Sem metadados estruturados, o retrieval retorna chunks mas você não sabe de qual
documento, qual página, qual seção eles vieram. Útil para:
- Citar a fonte no texto gerado
- Debug do retrieval
- Filtros por tipo de documento (artigo, lei, livro)

**Schema sugerido:**
```
ChunkMetadata {
  id, attachmentId, tccId, userId,
  text, embedding (vector),
  pageNumber, sectionTitle, chunkIndex, tokenCount
}
```

---

### GAP-07 — Observabilidade do retrieval

Sem logs estruturados do retrieval, é impossível depurar por que o modelo gerou
um resultado ruim. O que seria útil logar:
- Query original do usuário
- Top-k chunks recuperados (com score de similaridade)
- Prompt final enviado ao modelo
- Tokens usados
- Tempo de resposta por etapa

O `trackEvent` em `src/lib/analytics.ts` pode ser estendido para isso, mas precisa
de um backend de ingestão real (não só `console.info`).

---

### GAP-08 — Segurança multi-tenant no retrieval

**Risco atual:** se o banco vetorial for implementado sem filtros adequados, um usuário
poderia teoricamente recuperar chunks de documentos de outro usuário.

**Mitigação obrigatória:** todo retrieval deve incluir `filter: { userId, tccId }`.
pgvector suporta isso nativamente com `WHERE` clauses no SQL.

---

## Gaps de baixa prioridade (pós-RAG)

### GAP-09 — Reranking

Após o retrieval top-k, um modelo de reranking (cross-encoder) reordena os chunks
por relevância real para a query. Melhora qualidade mas adiciona latência e custo.
Relevante apenas quando o retrieval básico já estiver funcionando bem.

### GAP-10 — Busca híbrida (vetorial + BM25)

Combina busca semântica com busca por palavra-chave. Útil para termos técnicos,
nomes próprios e siglas acadêmicas que embeddings às vezes tratam mal.
Implementável com `pgvector` + `pg_trgm` ou `tsvector` no PostgreSQL.

### GAP-11 — Avaliação da qualidade do RAG

Métricas como RAGAS (faithfulness, answer relevancy, context recall) permitem
avaliar se o retrieval está contribuindo para respostas melhores. Necessário
antes de otimizações avançadas.

---

## Resumo de prioridades

| Gap | Prioridade | Impacto no produto |
|---|---|---|
| GAP-01: Ingestão de PDFs | Alta | Libera o valor prometido pelos uploads de referência |
| GAP-02: Chunking | Alta | Pré-requisito para qualquer indexação |
| GAP-03: Embeddings | Alta | Núcleo do RAG |
| GAP-04: pgvector | Alta | Infraestrutura do RAG |
| GAP-05: Retrieval top-k | Alta | Transforma a arquitetura em RAG real |
| GAP-06: Metadados | Média | Qualidade e debug |
| GAP-07: Observabilidade | Média | Capacidade de melhorar iterativamente |
| GAP-08: Multi-tenant seguro | Média | Segurança obrigatória antes de escalar |
| GAP-09: Reranking | Baixa | Otimização pós-RAG |
| GAP-10: Busca híbrida | Baixa | Otimização pós-RAG |
| GAP-11: Avaliação RAGAS | Baixa | Benchmarking avançado |

---

_Próximo: [05 — Runbook](05-runbook.md)_
