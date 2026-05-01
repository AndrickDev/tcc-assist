# ADR-0002 — pgvector como vector store

- **Status:** Aceito
- **Data:** 2026-05-01
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, ia, rag, banco

---

## Contexto

O próximo passo do RAG é recuperar contexto a partir de duas fontes que já existem no produto:

- PDFs enviados pelo usuário, hoje armazenados no Vercel Blob via `Attachment.fileUrl`.
- Abstracts vindos do OpenAlex, hoje persistidos em `Reference.abstract`.

Para que o serviço FastAPI consiga responder com base nesses materiais, precisamos transformar
PDFs e abstracts em chunks, gerar embeddings e executar busca vetorial por similaridade. Esse dado
é complementar ao schema de produto: o Prisma continua dono de `User`, `Tcc`, `Message`,
`Reference` e `Attachment`; o serviço de IA passa a manter apenas o schema de RAG.

O volume esperado no estágio atual não justifica um vector DB dedicado:

- ~50 chunks por PDF.
- ~5 PDFs por TCC.
- ~2 TCCs por usuário VIP.
- Em 1k usuários pagantes: ~500k chunks.

Esse volume cobre 90% dos casos iniciais usando Postgres com `pgvector`, sem introduzir outro
serviço operacional.

## Decisão

Usar **pgvector na mesma instância Postgres do produto**, acessada via `POSTGRES_URL`.

As tabelas `chunks`, `embeddings` e `ingestion_jobs` serão criadas e evoluídas por **Alembic no
repositório FastAPI** (`tcc-assist-ai`). O Prisma, neste repo Next.js, continua responsável somente
pelo schema de produto: `User`, `Tcc`, `Message`, `Reference` e `Attachment`.

Essa separação segue a convenção de não-sobreposição definida na ADR-0001: Prisma é dono do schema
"produto"; Alembic é dono do schema "RAG".

**Parâmetros iniciais:**

- Métrica de distância: `cosine`, adequada para embeddings normalizados.
- Dimensão do embedding: `1024`, assumindo `bge-m3` como modelo local de embeddings (a confirmar
  formalmente na ADR-0003).
- Índice inicial: `IVFFlat` com `lists = 100`.
- Evolução para `HNSW`: quando o p95 de retrieval ultrapassar 100ms em produção.

`lists = 100` é uma escolha inicial. O valor final deve ser tratado como TBD operacional e ajustado
com dados reais de volume, recall e latência.

## Consequências

### Positivas
- Mantém um único Postgres para produto e RAG, simplificando operação.
- Backup, restore e observabilidade de banco continuam unificados.
- Não adiciona serviço pago novo no estágio beta.
- Aproveita ferramentas maduras do ecossistema Postgres.
- Reduz latência e complexidade em comparação com uma chamada de rede para vector DB externo.

### Negativas
- Retrieval vetorial pode disputar I/O com queries transacionais conforme o volume de chunks crescer.
  Mitigação futura: read replica para consultas RAG.
- O schema fica administrado por duas ferramentas, Prisma e Alembic, o que exige disciplina para não
  sobrepor responsabilidades.
- Tuning de índice (`lists`, `probes`, vacuum/analyze) passa a ser responsabilidade operacional do
  time.

### Neutras
- O vector store fica atrelado ao Postgres. Se o produto trocar de banco principal, a camada vetorial
  precisará ser revista junto.
- `pgvector` resolve retrieval inicial, mas não elimina a necessidade futura de rerank no serviço
  FastAPI.

## Alternativas consideradas

**A. Pinecone.**
Rejeitada. Introduz lock-in, custo mínimo em torno de US$70/mês e latência adicional de rede sem
necessidade para o volume inicial.

**B. Qdrant Cloud.**
Rejeitada agora. É tecnicamente bom para busca vetorial, mas adiciona mais um serviço para operar,
monitorar e pagar antes de haver escala que justifique.

**C. Weaviate Cloud.**
Rejeitada agora pelo mesmo motivo do Qdrant: aumenta superfície operacional e custo recorrente sem
resolver um gargalo presente.

**D. Vector store em memória com FAISS puro.**
Rejeitada. Não persiste estado, dificulta deploy horizontal e exigiria reconstrução de índice em
restart ou deploy.

**E. SQLite + sqlite-vss.**
Rejeitada. Não é adequada para múltiplos writers concorrentes nem para o modelo SaaS com vários TCCs
e jobs de ingestão em paralelo.

## Notas de implementação

- Migration inicial no repo FastAPI: `CREATE EXTENSION IF NOT EXISTS vector;`.
- Tabela `chunks`:
  - `id` PK.
  - `tcc_id` FK para o TCC do schema de produto.
  - `source_type` ENUM.
  - `source_id`.
  - `text` TEXT.
  - `position` INT.
  - `metadata` JSONB.
  - `created_at`.
- Tabela `embeddings`:
  - `chunk_id` FK PK.
  - `vector` VECTOR(1024).
  - `model_version` TEXT.
  - `created_at`.
- Tabela `ingestion_jobs`:
  - `id` PK.
  - `tcc_id`.
  - `source_type` ENUM.
  - `status` ENUM.
  - `started_at`.
  - `finished_at`.
  - `error` TEXT NULL.
- Índice inicial: `ivfflat` em `embeddings.vector vector_cosine_ops` com `lists = 100`.
- Gatilho de reavaliação 1: ao passar de 1M chunks, medir p95/recall e considerar `HNSW`.
- Gatilho de reavaliação 2: ao passar de 10M chunks, revisitar este ADR e considerar vector DB
  dedicada.

## Referências

- ADR-0001 — Separação do serviço de IA em FastAPI com RAG.
- ADR-0003 — Gemini API ao invés de LLM local (a escrever em BL-002, incluindo confirmação do
  `bge-m3` para embeddings).

