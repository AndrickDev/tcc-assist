```markdown
# T-G2.1 Fix Google embedding provider para API real

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg2.1-embedding-fix`.
T-G2 (PR #30) merged em `main` mas smoke contra a API real falhou com 404.

Causa: brief T-G2 assumiu `text-embedding-004` + `:batchEmbedContents` baseado em snapshot
desatualizado da API Google. A API ao vivo retorna 3 modelos de embedding em `v1beta`:
`gemini-embedding-001`, `gemini-embedding-2`, `gemini-embedding-2-preview`. Métodos
suportados: `embedContent` (síncrono single), `asyncBatchEmbedContent` (assíncrono
file-based). NÃO existe `:batchEmbedContents` síncrono.

ADRs:
- ADR-0001 — providers isolados.
- ADR-0002 — dim 768 fixado em `embeddings.vector` (mantido — MRL viabiliza).
- ADR-0008 — provider MVP Google. Texto desatualizado, atualizar nome do modelo + endpoint + nota MRL.

## Verified state — do not re-infer

Probes executados contra a API ao vivo com `GOOGLE_API_KEY` de produção em 2026-06-02:

```
GET https://generativelanguage.googleapis.com/v1beta/models?key=...
-> models/gemini-embedding-001  methods: embedContent, asyncBatchEmbedContent, countTextTokens, countTokens
   models/gemini-embedding-2-preview
   models/gemini-embedding-2

POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=...
  body {"model":"models/gemini-embedding-001","content":{"parts":[{"text":"teste"}]}}
-> {"embedding":{"values":[3072 floats]}}

POST .../embedContent com {"outputDimensionality":768}
-> {"embedding":{"values":[768 floats]}} NÃO normalizados (sum of squares != 1)
```

Conclusões fixas (não re-investigar):

- Modelo correto: `gemini-embedding-001` (estável). Não usar variantes 2/2-preview até nova decisão.
- Endpoint correto: `:embedContent`. Não existe batch síncrono.
- Default dim do modelo: 3072. Para manter `Vector(768)` no schema usar `outputDimensionality: 768`.
- Resposta single: `{"embedding": {"values": [...]}}` (chave singular `embedding`, NÃO `embeddings` array).
- Vetores NÃO vêm normalizados. Para `vector_cosine_ops` no pgvector funcionar com cosine real, normalizar L2 client-side antes de cache/persistência.
- Free tier ainda 1500 RPM por API key (não mudou).

Estado atual do código (a substituir):

- `services/ai/app/providers/embedding.py` linha 21: `GOOGLE_EMBED_MODEL = "text-embedding-004"` (INVÁLIDO).
- Linha 23: `GOOGLE_EMBED_MAX_BATCH = 100` (não aplica mais — sem batch sync).
- Linha 95: URL usa `:batchEmbedContents` (404).
- Linha 98-106: payload `{"requests": [{"model":..., "content":...}, ...]}` (não existe).
- Linha 117: parse `data["embeddings"]` (chave errada).
- Sem `outputDimensionality` no payload.
- Sem normalização L2.
- Testes em `services/ai/tests/providers/test_embedding.py` mockam o endpoint antigo — todos
  precisam ser reescritos contra `:embedContent`.

Estado preservado (NÃO MEXER):

- `EmbeddingProvider` Protocol, `EmbedResult`, factory `get_embedding_provider()`.
- Exceptions em `app/providers/exceptions.py`.
- Backoff/jitter e a estrutura de `_post_with_retry` (mecânica genérica).
- `app/rag/embedding_cache.py` e `app/rag/embedder.py` (não dependem do shape de payload).
- Tests de cache/embedder/factory continuam válidos.

## Scope

### 1. Reescrever `services/ai/app/providers/embedding.py`

Substituir constantes:

```python
GOOGLE_EMBED_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta"
GOOGLE_EMBED_MODEL: Final[str] = "gemini-embedding-001"
GOOGLE_EMBED_DIM: Final[int] = 768
# Removido GOOGLE_EMBED_MAX_BATCH — API sync não suporta batch.
# Limite de concorrência local para asyncio.gather (proteção rate limit).
GOOGLE_EMBED_CONCURRENCY: Final[int] = 10
```

Substituir `_embed_batch` por chamada paralela 1-texto-por-request com semáforo.
Atualizar `embed()` para coletar resultados ordenados:

```python
async def embed(self, texts: Sequence[str]) -> EmbedResult:
    if not texts:
        return EmbedResult(model=self.model, dim=self.dim, vectors=[])

    client = self._client or httpx.AsyncClient(timeout=self._timeout_s)
    owns_client = self._client is None
    try:
        sem = asyncio.Semaphore(GOOGLE_EMBED_CONCURRENCY)

        async def one(text: str) -> list[float]:
            async with sem:
                return await self._embed_one(client, text)

        vectors = await asyncio.gather(*(one(t) for t in texts))
    finally:
        if owns_client:
            await client.aclose()

    if any(len(vector) != self.dim for vector in vectors):
        raise EmbeddingBadResponse(
            f"dimensao inesperada esperado={self.dim} "
            f"recebido={[len(v) for v in vectors]}"
        )
    return EmbedResult(model=self.model, dim=self.dim, vectors=vectors)
```

Adicionar `_embed_one`:

```python
async def _embed_one(self, client: httpx.AsyncClient, text: str) -> list[float]:
    url = (
        f"{GOOGLE_EMBED_BASE_URL}/models/{self.model}:embedContent"
        f"?key={self._api_key}"
    )
    payload: dict[str, object] = {
        "model": f"models/{self.model}",
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": self.dim,
    }
    response = await self._post_with_retry(client, url, payload)
    try:
        data = response.json()
        values = data["embedding"]["values"]
        raw = [float(v) for v in values]
    except (KeyError, ValueError, TypeError) as exc:
        raise EmbeddingBadResponse(f"payload Google invalido: {exc}") from exc
    return _l2_normalize(raw)
```

Adicionar helper de normalização no fim do módulo:

```python
def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0.0:
        return vector
    return [v / norm for v in vector]
```

Importar `math` no topo. `_post_with_retry` permanece igual (mecânica genérica).

### 2. Atualizar `services/ai/tests/providers/test_embedding.py`

Substituir mocks de `:batchEmbedContents` por `:embedContent`. Casos a reescrever:

- Happy path 1 texto: respx mocka `:embedContent` retornando `{"embedding": {"values": [...768 floats normalizáveis...]}}`. Asserta `len(result.vectors) == 1`, `result.dim == 768`, `result.model == "gemini-embedding-001"`, e vetor retornado tem norm ≈ 1 (pós-normalização client).
- Múltiplos textos: respx mocka N requests (uma por texto). Asserta ordem preservada — útil setar respostas determinísticas por payload.text.
- 429 → retry → success (mesma mecânica de `_post_with_retry`).
- Persistente 429 → `EmbeddingRateLimited`.
- Persistente 5xx → `EmbeddingUnavailable`.
- Empty input retorna `EmbedResult` vazio sem HTTP.
- Wrong dim (mock retorna 512 floats) → `EmbeddingBadResponse`.
- Missing API key → `EmbeddingUnavailable` na construção.
- Vetor não-normalizado vindo do mock deve sair normalizado (norm ≈ 1).

Remover `MAX_BATCH` da fixture. Confirmar concorrência: para teste de 15 textos com
`GOOGLE_EMBED_CONCURRENCY=10`, todas as 15 chamadas devem ocorrer e a ordem do
output deve casar com a do input.

Monkeypatch `asyncio.sleep` para no-op em casos de retry para não adicionar wall time.

### 3. Atualizar `services/ai/README.md`

Substituir a menção a `text-embedding-004` (se houver) por `gemini-embedding-001`. Adicionar
nota curta na seção "Embedding provider":

```markdown
Modelo: `gemini-embedding-001` (Google Generative AI). Dimensão reduzida via Matryoshka
Representation Learning (`outputDimensionality: 768`) — o modelo nativamente produz 3072
floats e a API entrega o prefixo de 768 dimensões. Vetores são normalizados (L2) no cliente
antes de ir para cache/Postgres para o `vector_cosine_ops` operar corretamente.
```

### 4. Atualizar `docs/adr/0008-embedding-provider-mvp.md`

Adicionar bloco de emenda no topo (mesmo padrão do ADR-0002):

```markdown
> **Emenda 2026-06-02 — correção do nome do modelo e do endpoint:**
> O texto original deste ADR citava `text-embedding-004` e `:batchEmbedContents`. A API ao
> vivo (probe em 2026-06-02) lista apenas `gemini-embedding-001`, `gemini-embedding-2` e
> `gemini-embedding-2-preview`, com métodos `:embedContent` (sync single) e
> `:asyncBatchEmbedContent` (assíncrono file-based). Não existe batch síncrono.
> O modelo `gemini-embedding-001` produz 3072 dimensões por padrão; mantemos `dim=768`
> via parâmetro `outputDimensionality` da própria API (Matryoshka Representation Learning).
> A escolha de provider, free tier, abstração e migration path documentados abaixo
> permanecem válidos.
```

Em §"Decisão", trocar:

- `models/text-embedding-004` → `models/gemini-embedding-001`
- Acrescentar bullet: `Parâmetro outputDimensionality: 768 nas requisições`.
- Acrescentar bullet: `Normalização L2 client-side antes de cache/persistência`.

## Closed decisions

- Modelo: `gemini-embedding-001`. Não `gemini-embedding-2` nem variante preview (estabilidade primeiro).
- Endpoint: `:embedContent` por texto, paralelizado via `asyncio.gather` com semáforo.
- Concorrência local: 10 chamadas simultâneas por instância de provider. Vale para a vida do `embed()`.
- Dim final: 768 (mantido) via `outputDimensionality: 768`. Sem mexer em migration / schema.
- Normalização: L2 client-side, dentro de `_embed_one` antes de retornar.
- Mecânica de backoff/jitter: inalterada. `_post_with_retry` continua o mesmo.
- Cache, embedder, factory, exceptions: não mudam.

## Do not do

- Não trocar para `gemini-embedding-2` ou `gemini-embedding-2-preview`.
- Não alterar `EmbeddingProvider` Protocol, `EmbedResult`, factory, ou exceptions.
- Não alterar `app/rag/embedding_cache.py` ou `app/rag/embedder.py`.
- Não alterar a migration 0001 nem o schema. Dim continua 768.
- Não introduzir SDK Google (`google-genai`). Continuar com `httpx`.
- Não tentar usar `asyncBatchEmbedContent` (é file-based, exige bucket — fora do MVP).
- Não tentar batchear N textos em um único request — não existe método sync para isso.
- Não normalizar duas vezes (cliente apenas; pgvector não normaliza no `vector_cosine_ops`).
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `grep -q 'GOOGLE_EMBED_MODEL: Final\[str\] = "gemini-embedding-001"' services/ai/app/providers/embedding.py`
- `! grep -q 'text-embedding-004' services/ai/app/providers/embedding.py`
- `grep -q ':embedContent' services/ai/app/providers/embedding.py`
- `! grep -q ':batchEmbedContents' services/ai/app/providers/embedding.py`
- `grep -q '"outputDimensionality"' services/ai/app/providers/embedding.py`
- `grep -q 'def _l2_normalize' services/ai/app/providers/embedding.py`
- `grep -q 'asyncio.Semaphore' services/ai/app/providers/embedding.py`
- `grep -q 'gemini-embedding-001' docs/adr/0008-embedding-provider-mvp.md`
- `grep -q 'outputDimensionality' docs/adr/0008-embedding-provider-mvp.md`
- `! grep -q 'text-embedding-004' docs/adr/0008-embedding-provider-mvp.md`

Behavioral checks (covered by updated tests):

- 1 texto → 1 vetor dim 768, norma ≈ 1.0.
- 15 textos → 15 vetores na mesma ordem do input.
- 429 transitório com sucesso na retry seguinte.
- 429 persistente → `EmbeddingRateLimited` após `max_retries + 1` tentativas.
- 5xx persistente → `EmbeddingUnavailable`.
- Empty input → 0 chamadas HTTP.
- Mock retorna 512 floats → `EmbeddingBadResponse`.
- API key ausente → `EmbeddingUnavailable` na construção.
- Mock retorna vetor não-normalizado → output normalizado (norm ≈ 1).

## Gates

`apps/web` não tocado. Skip.

`services/ai`:

```bash
cd services/ai
uv sync --extra dev
uv run ruff check .
uv run mypy app tests
uv run pytest -q
```

Expected: 99 prior tests verde, com o conjunto de embedding adaptado ao novo endpoint.
Sem regressão. Total esperado igual ou levemente menor se algum teste de batch foi
consolidado em um teste de concorrência.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg2.1-embedding-fix
```

Single commit:

```
fix(ai): aponta provider para gemini-embedding-001 + MRL 768 + L2 norm (T-G2.1)

API Google v1beta nao oferece text-embedding-004 nem :batchEmbedContents.
Probes 2026-06-02 confirmam gemini-embedding-001 com :embedContent (sync
single) e asyncBatchEmbedContent (async file-based). Modelo nativamente
3072 dims; manteve dim=768 via outputDimensionality.

Substitui batch sync por asyncio.gather com semaforo
(GOOGLE_EMBED_CONCURRENCY=10). Adiciona normalizacao L2 client-side
antes de cache/persistencia, necessaria para vector_cosine_ops do
pgvector operar corretamente — modelo entrega vetores nao normalizados.

Exceptions, cache, embedder, factory, schema e migration inalterados.
Testes atualizados para mockar :embedContent.

ADR-0008 emenda inline registrando a correcao do modelo + endpoint
e a chegada do parametro outputDimensionality.
```

Não push, não abrir PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Lista de arquivos modificados com line counts.
3. Output dos 4 gates (`uv sync`, `ruff check`, `mypy app tests`, `pytest -q`).
4. Delta de testes (99 → ?).
5. Resultado de um teste novo onde o mock retorna vetor não-normalizado: norma de entrada e
   norma de saída para confirmar L2.
6. Quaisquer desvios com justificativa.
```
