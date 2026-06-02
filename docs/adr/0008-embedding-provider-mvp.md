# ADR-0008 — Provider de embedding para o MVP: Google text-embedding-004

- **Status:** Aceito
- **Data:** 2026-06-02
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, ia, rag, custo

---

## Contexto

ADR-0001 e ADR-0002 (versão original) pressupunham `bge-m3` rodando local no FastAPI:
embeddings residentes em memória, latência sub-100ms, dim 1024. Essa premissa exige uma VM
Fly com pelo menos 4 GB de RAM (~US$15–30/mês) só para manter o modelo carregado.

Estado atual do projeto:
- Zero clientes pagantes. Receita = 0.
- Fase 4 (RAG) é a primeira em que o serviço FastAPI passa a fazer trabalho não-trivial
  além de orchestrar o Gemini.
- ADR-0007 fixou a VM Fly atual em 256 MB (US$5/mês). Aumentar agora consome runway sem retorno.
- Já existe `GEMINI_API_KEY` em produção (chat funcional desde 2026-05-13). Google
  Generative AI API oferece `text-embedding-004` no mesmo billing/account.

A pergunta: gastar US$15–30/mês adicional agora para honrar a escolha ideal de modelo,
ou ajustar a escolha ao orçamento e re-avaliar quando houver receita?

## Decisão

Adotar **Google `text-embedding-004`** como provider de embeddings do MVP, acessado via HTTP
com a mesma `GEMINI_API_KEY` já configurada.

- **Modelo:** `models/text-embedding-004` (Google Generative AI API).
- **Dimensão:** 768 (fixa). ADR-0002 emendado para `Vector(768)` antes do primeiro deploy.
- **Métrica:** cosine (inalterada — modelo produz vetores normalizados).
- **Free tier (2026-06):** 1500 requests/min, sem custo até atingir.
- **Onde mora:** novo módulo `services/ai/app/providers/embedding.py`, atrás da Protocol
  `EmbeddingProvider`, registrado por factory `get_embedding_provider()`.

## Consequências

### Positivas
- **US$0/mês adicional até bater free tier.** Mantém runway pra outras fases.
- **Zero infra extra.** VM Fly 256 MB continua suficiente — nada de modelo residente.
- **Reuso de credencial.** `GEMINI_API_KEY` já gerenciada, monitorada e rotacionável.
- **Latência aceitável.** ~150 ms p95 por chamada de embed; somado a ~20 ms de pgvector
  e ~2–5 s de geração Gemini, o retrieval some no ruído do LLM.
- **Cache Redis amortiza burst.** T-G2 inclui cache `embed:{model}:{sha256(text)}` com TTL
  configurável; reembed do mesmo chunk não conta no quota.

### Negativas
- **Qualidade multilíngue inferior a bge-m3.** `text-embedding-004` é multilíngue mas não
  state-of-the-art em PT-BR comparado a bge-m3. Aceitável para abstracts OpenAlex (90%+ em
  inglês) e PDFs de TCC (PT-BR) na fase de validação.
- **Vendor lock leve.** Resolvido por `EmbeddingProvider` Protocol e factory env-driven.
- **Dim 768 < 1024 original.** Migração futura para dim maior exige re-embed completo.
  Playbook descrito em §"Migration path" abaixo.
- **Rate limit visível.** 1500 RPM é alto para o MVP mas finito; T-G2 inclui exponential
  backoff e jitter para absorver picos sem 429 vazar para o usuário.

### Neutras
- pgvector e Alembic continuam donos do schema RAG. Apenas a dimensão da coluna mudou.
- IVFFlat `lists=100` permanece adequado para dim 768 e o volume previsto.

## Arquitetura — pontos de extensibilidade

A escolha do provider é uma decisão de **MVP**, não permanente. O design garante:

1. **`EmbeddingProvider` Protocol** em `app/providers/embedding.py`:
   ```python
   class EmbeddingProvider(Protocol):
       model: str
       dim: int
       async def embed(self, texts: Sequence[str]) -> list[list[float]]: ...
   ```
2. **Factory env-driven**: `get_embedding_provider()` lê `EMBEDDING_PROVIDER` (`google` |
   `bge_m3_local` | `bge_m3_hf` etc.). Trocar provider em produção é mudar env, sem rebuild.
3. **Coluna `embeddings.model` por row**: cada chunk sabe qual provider gerou o vetor.
   Permite coexistência durante migração.
4. **Cache key namespaced pelo `model`**: `embed:{model}:{hash}` evita cross-contamination
   ao trocar provider.

## Migration path (quando bge-m3 viável)

Quando receita justificar Fly VM 4 GB (ou equivalente para hospedar o modelo):

1. Subir novo provider `bge_m3_local` ao lado do atual. Não substituir o factory ainda.
2. Migration Alembic: `ALTER TABLE embeddings ADD COLUMN vector_v2 vector(1024);` mais o
   índice IVFFlat para a nova coluna.
3. Dual-write: ingestion grava `vector` (Google, dim 768) e `vector_v2` (bge-m3, dim 1024)
   por algumas semanas até consolidar.
4. Backfill assíncrono re-embeda chunks históricos via `bge_m3_local`, preenchendo
   `vector_v2` e atualizando `embeddings.model` para `bge-m3`.
5. Swap retrieval para `vector_v2`. Validar qualidade (recall, latência).
6. Migration de cleanup: `DROP COLUMN vector;`. Manter o índice antigo até confirmar
   produção estável.

Esse playbook é o padrão de migration dual-write para mudança de dim em pgvector.
Não é trivial mas é trilho conhecido, sem reescrever orchestrator nem retrieval.

## Quando reavaliar

Critérios de re-decisão (qualquer um dispara revisão):

- **Receita:** primeiro cliente pagante. Orçamento abre — reavalia bge-m3 local.
- **Volume:** consumo do free tier Google > 50%. Considera Tier 1 ou migração.
- **Qualidade:** recall em corpus PT-BR de avaliação < limite definido em T-G5.
- **Latência:** p95 de embed > 500 ms ou de retrieval E2E > 1 s.
- **Vendor risk:** mudança de política Google que afete preço ou disponibilidade.

## Alternativas consideradas

| Opção | Por que descartada para MVP |
|---|---|
| `bge-m3` local + Fly VM 4 GB | US$15–30/mês adicional sem receita. Ideal pós-validação. |
| `bge-m3` via Hugging Face Inference API | Rate limits free tier instáveis; pay-per-token cresce com uso. |
| `bge-large-en-v1.5` local (dim 1024, 1.3 GB) | Ainda exige VM 2 GB (~US$10/mês) e qualidade PT-BR pior que bge-m3. |
| OpenAI `text-embedding-3-small` (dim 1536) | Custo por token > Google free tier no estágio atual. Outro vendor para credenciar. |
| Cohere `embed-multilingual-v3` (dim 1024) | Free tier menos generoso; outro vendor. |

## Referências

- ADR-0001 — separação FastAPI + RAG.
- ADR-0002 — pgvector como vector store (emendado em 2026-06-02 para dim 768).
- ADR-0003 — Gemini API ao invés de LLM local. ADR-0008 estende a mesma lógica para embeddings.
- ADR-0007 — Fly.io como host inicial (VM 256 MB).
- Google AI docs: `https://ai.google.dev/gemini-api/docs/embeddings` (consultar para limites
  vigentes; valores deste ADR refletem 2026-06).
