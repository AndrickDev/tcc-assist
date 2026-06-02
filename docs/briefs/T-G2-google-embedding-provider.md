```markdown
# T-G2 Google embedding provider + Redis cache

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg2-google-embedding`.
T-G1 (PR #28) is already merged on `main`. The embedding-dim amend lives in a separate PR
(`feat/embedding-mvp-google`) that lowers `embeddings.vector` from `Vector(1024)` to
`Vector(768)` and introduces ADR-0008. Branch off `main` AFTER that PR is merged so the
schema already matches dim 768. Phase 4 (RAG), second task.

ADRs:
- ADR-0001: providers live in `services/ai/app/providers/`. Provider isolated from orchestrator.
- ADR-0002 (amended 2026-06-02): dim 768 fixed.
- ADR-0003: Gemini used via Google API, not local. Same pattern applies to embeddings.
- ADR-0008: Google `text-embedding-004` chosen for MVP. `EmbeddingProvider` Protocol +
  `get_embedding_provider()` factory env-driven. Redis cache keyed by `embed:{model}:{sha256(text)}`.

## Verified state — do not re-infer

- `services/ai/app/providers/` contains: `__init__.py`, `exceptions.py` (`ProviderError`,
  `GeminiUnavailable`, `GeminiBadResponse`), `gemini.py` (httpx async, `GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta"`), `postprocess.py`.
- Gemini reads API key from env `GOOGLE_API_KEY` (NOT `GEMINI_API_KEY` — ADR-0008 prose has a
  small error; this brief is canonical for the env name). Re-use the same variable.
- `services/ai/app/rag/` contains only `__init__.py` (`"""Retrieval-augmented generation pipeline."""`).
- Redis is already used by quota at `services/ai/app/quota/`. Check `quota/redis_client.py` or
  equivalent for the connection factory; reuse it instead of opening a second client.
- `structlog.get_logger(__name__)` is the project logging convention.
- Tests use `respx` to mock httpx + `fakeredis` for Redis. Async mode enabled (`asyncio_mode = "auto"`).
- mypy strict; ruff lints E F I B UP SIM; line length 100.

## Scope

### 1. Exceptions — append to `services/ai/app/providers/exceptions.py`

```python
class EmbeddingUnavailable(ProviderError):
    """Raised when the embedding backend cannot serve a request (network, 5xx)."""


class EmbeddingRateLimited(ProviderError):
    """Raised when the embedding backend signals rate limiting (429) after retries."""


class EmbeddingBadResponse(ProviderError):
    """Raised when the embedding backend returns an unexpected payload shape."""
```

### 2. New module `services/ai/app/providers/embedding.py`

```python
from __future__ import annotations

import asyncio
import os
import random
from collections.abc import Sequence
from time import perf_counter
from typing import Final, Protocol, runtime_checkable

import httpx
import structlog
from pydantic import BaseModel, ConfigDict

from app.providers.exceptions import (
    EmbeddingBadResponse,
    EmbeddingRateLimited,
    EmbeddingUnavailable,
)

GOOGLE_EMBED_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta"
GOOGLE_EMBED_MODEL: Final[str] = "text-embedding-004"
GOOGLE_EMBED_DIM: Final[int] = 768
GOOGLE_EMBED_MAX_BATCH: Final[int] = 100  # Google batchEmbedContents per-request limit.

DEFAULT_TIMEOUT_S: Final[float] = 10.0
DEFAULT_MAX_RETRIES: Final[int] = 4
DEFAULT_BASE_BACKOFF_S: Final[float] = 0.4
DEFAULT_MAX_BACKOFF_S: Final[float] = 8.0

log = structlog.get_logger(__name__)


class EmbedResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: str
    dim: int
    vectors: list[list[float]]


@runtime_checkable
class EmbeddingProvider(Protocol):
    model: str
    dim: int

    async def embed(self, texts: Sequence[str]) -> EmbedResult: ...


class GoogleEmbeddingProvider:
    """Embeddings via Google Generative AI `text-embedding-004`.

    Reuses GOOGLE_API_KEY env (same as gemini.py). No SDK dependency:
    one httpx call per batch of up to 100 texts.
    """

    model: str = GOOGLE_EMBED_MODEL
    dim: int = GOOGLE_EMBED_DIM

    def __init__(
        self,
        *,
        api_key: str | None = None,
        client: httpx.AsyncClient | None = None,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_backoff_s: float = DEFAULT_BASE_BACKOFF_S,
        max_backoff_s: float = DEFAULT_MAX_BACKOFF_S,
    ) -> None:
        self._api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not self._api_key:
            raise EmbeddingUnavailable("GOOGLE_API_KEY ausente")
        self._client = client
        self._timeout_s = timeout_s
        self._max_retries = max_retries
        self._base_backoff_s = base_backoff_s
        self._max_backoff_s = max_backoff_s

    async def embed(self, texts: Sequence[str]) -> EmbedResult:
        if not texts:
            return EmbedResult(model=self.model, dim=self.dim, vectors=[])
        batches = [
            list(texts[i : i + GOOGLE_EMBED_MAX_BATCH])
            for i in range(0, len(texts), GOOGLE_EMBED_MAX_BATCH)
        ]
        vectors: list[list[float]] = []
        for batch in batches:
            vectors.extend(await self._embed_batch(batch))
        if any(len(v) != self.dim for v in vectors):
            raise EmbeddingBadResponse(
                f"dimensao inesperada esperado={self.dim} recebido={[len(v) for v in vectors]}"
            )
        return EmbedResult(model=self.model, dim=self.dim, vectors=vectors)

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        url = (
            f"{GOOGLE_EMBED_BASE_URL}/models/{self.model}:batchEmbedContents"
            f"?key={self._api_key}"
        )
        payload = {
            "requests": [
                {
                    "model": f"models/{self.model}",
                    "content": {"parts": [{"text": text}]},
                }
                for text in batch
            ]
        }
        client = self._client or httpx.AsyncClient(timeout=self._timeout_s)
        owns_client = self._client is None
        try:
            response = await self._post_with_retry(client, url, payload)
        finally:
            if owns_client:
                await client.aclose()

        try:
            data = response.json()
            embeddings = data["embeddings"]
            return [list(map(float, item["values"])) for item in embeddings]
        except (KeyError, ValueError, TypeError) as err:
            raise EmbeddingBadResponse(f"payload Google invalido: {err}") from err

    async def _post_with_retry(
        self,
        client: httpx.AsyncClient,
        url: str,
        payload: dict[str, object],
    ) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            started = perf_counter()
            try:
                response = await client.post(url, json=payload)
            except httpx.RequestError as err:
                last_exc = err
                log.warning(
                    "embed_http_error",
                    attempt=attempt,
                    error=str(err),
                    elapsed_ms=int((perf_counter() - started) * 1000),
                )
            else:
                if response.status_code == 429:
                    last_exc = EmbeddingRateLimited("429 do provider")
                    log.warning("embed_rate_limited", attempt=attempt)
                elif 500 <= response.status_code < 600:
                    last_exc = EmbeddingUnavailable(f"upstream {response.status_code}")
                    log.warning(
                        "embed_upstream_5xx",
                        attempt=attempt,
                        status=response.status_code,
                    )
                else:
                    response.raise_for_status()
                    return response
            if attempt == self._max_retries:
                break
            sleep_s = min(self._max_backoff_s, self._base_backoff_s * (2**attempt))
            sleep_s += random.uniform(0, sleep_s * 0.25)
            await asyncio.sleep(sleep_s)
        assert last_exc is not None
        if isinstance(last_exc, EmbeddingRateLimited):
            raise last_exc
        raise EmbeddingUnavailable(str(last_exc))


def get_embedding_provider() -> EmbeddingProvider:
    """Factory env-driven. Default `google`.

    EMBEDDING_PROVIDER=google -> GoogleEmbeddingProvider
    Future values (bge_m3_local, bge_m3_hf, ...) plug here without orchestrator change.
    """
    name = os.environ.get("EMBEDDING_PROVIDER", "google").strip().lower()
    if name == "google":
        return GoogleEmbeddingProvider()
    raise EmbeddingUnavailable(f"EMBEDDING_PROVIDER desconhecido: {name!r}")
```

### 3. New module `services/ai/app/rag/embedding_cache.py`

```python
from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from typing import Final

import structlog
from redis.asyncio import Redis

DEFAULT_TTL_S: Final[int] = 60 * 60 * 24 * 30  # 30 days.

log = structlog.get_logger(__name__)


def cache_key(model: str, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"embed:{model}:{digest}"


async def get_many(
    redis: Redis,
    model: str,
    texts: Sequence[str],
) -> list[list[float] | None]:
    if not texts:
        return []
    keys = [cache_key(model, t) for t in texts]
    raw = await redis.mget(keys)
    result: list[list[float] | None] = []
    for item in raw:
        if item is None:
            result.append(None)
            continue
        try:
            decoded = item.decode("utf-8") if isinstance(item, bytes) else item
            parsed = json.loads(decoded)
            if not isinstance(parsed, list):
                result.append(None)
                continue
            result.append([float(x) for x in parsed])
        except (ValueError, TypeError):
            result.append(None)
    return result


async def set_many(
    redis: Redis,
    model: str,
    pairs: Sequence[tuple[str, list[float]]],
    ttl_s: int = DEFAULT_TTL_S,
) -> None:
    if not pairs:
        return
    async with redis.pipeline(transaction=False) as pipe:
        for text, vector in pairs:
            await pipe.set(cache_key(model, text), json.dumps(vector), ex=ttl_s)
        await pipe.execute()
```

### 4. New module `services/ai/app/rag/embedder.py`

Glue: caches hits, calls provider for misses, persists back to cache. Single public entry
point that the rest of the codebase (T-G3, T-G5) will use.

```python
from __future__ import annotations

from collections.abc import Sequence
from time import perf_counter

import structlog
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import embedding_cache

log = structlog.get_logger(__name__)


async def embed_texts(
    *,
    provider: EmbeddingProvider,
    redis: Redis,
    texts: Sequence[str],
) -> list[list[float]]:
    if not texts:
        return []
    started = perf_counter()
    cached = await embedding_cache.get_many(redis, provider.model, texts)
    misses_idx: list[int] = [i for i, v in enumerate(cached) if v is None]
    if misses_idx:
        miss_texts = [texts[i] for i in misses_idx]
        embed_result = await provider.embed(miss_texts)
        fresh = embed_result.vectors
        await embedding_cache.set_many(
            redis,
            provider.model,
            list(zip(miss_texts, fresh, strict=True)),
        )
        for idx, vec in zip(misses_idx, fresh, strict=True):
            cached[idx] = vec
    # All slots filled by either cache hit or fresh embedding.
    out = [v for v in cached if v is not None]
    if len(out) != len(texts):
        raise RuntimeError("cache fill inconsistente apos embed")
    log.info(
        "embed_texts_done",
        n_input=len(texts),
        n_cache_hits=len(texts) - len(misses_idx),
        elapsed_ms=int((perf_counter() - started) * 1000),
    )
    return out
```

### 5. Tests

`services/ai/tests/providers/test_embedding.py`:
- `respx` mocks `:batchEmbedContents` returning canonical Google payload.
- Cases: happy path single batch, happy path >100 texts (two batches), 429 → retry → success,
  persistent 429 → `EmbeddingRateLimited`, persistent 503 → `EmbeddingUnavailable`,
  empty input returns empty `EmbedResult`, wrong dim → `EmbeddingBadResponse`,
  missing API key → `EmbeddingUnavailable` at construction.
- Patch `asyncio.sleep` to a no-op via monkeypatch so backoff doesn't add wall time.

`services/ai/tests/providers/test_embedding_factory.py`:
- `EMBEDDING_PROVIDER` unset → returns `GoogleEmbeddingProvider`.
- `EMBEDDING_PROVIDER=google` → same.
- `EMBEDDING_PROVIDER=other` → raises `EmbeddingUnavailable`.

`services/ai/tests/rag/test_embedding_cache.py`:
- Round-trip set + get with `fakeredis.aioredis.FakeRedis`.
- `get_many` returns `None` for misses, decoded list for hits.
- Corrupted cache entry returns `None` (not raises).

`services/ai/tests/rag/test_embedder.py`:
- All hits → provider not called.
- All misses → provider called once with all texts, cache populated.
- Mixed hits/misses → provider called only with missing texts; output order matches input.
- Empty input returns empty list, provider not called.

Use existing fixtures: `fakeredis.aioredis.FakeRedis` for Redis, `respx.MockRouter` for HTTP.
Async test mode is already on.

### 6. Append to `services/ai/README.md`

After existing "Migrations" section:

```markdown
## Embedding provider

Embeddings vão via `EmbeddingProvider` (Protocol em `app/providers/embedding.py`). Default:
Google `text-embedding-004` (dim 768) — ver [ADR-0008](../../docs/adr/0008-embedding-provider-mvp.md).

Variáveis de ambiente:

- `EMBEDDING_PROVIDER` — `google` (default).
- `GOOGLE_API_KEY` — reuso da chave já usada pelo provider Gemini.

Cache em Redis (`embed:{model}:{sha256(text)}`, TTL 30 dias) amortiza embeds repetidos durante
ingestão e retrieval. Trocar de provider invalida apenas a parte do namespace daquele modelo.
```

## Closed decisions

- Provider: Google `text-embedding-004` (ADR-0008).
- Dim: 768 (ADR-0002 amend).
- Env: `GOOGLE_API_KEY` (reuse), `EMBEDDING_PROVIDER` (factory switch). Default `google`.
- HTTP client: `httpx.AsyncClient`, same pattern as `gemini.py`. No new SDK.
- Endpoint: `:batchEmbedContents` for up to 100 texts/request.
- Retries: 4 attempts, exponential backoff `0.4 * 2^attempt` with 25% jitter, capped at 8s.
  Triggers on `429` and `5xx`.
- Cache: Redis. Key `embed:{model}:{sha256(text)}`. Value JSON list of floats. TTL 30 days.
- Cache reuses the existing project Redis client (do not open a new connection pool).
- `EmbeddingProvider` is a `typing.Protocol` (runtime_checkable), not an ABC.
- `EmbedResult` is a frozen pydantic model carrying `model`, `dim`, `vectors`.
- No PII redaction in cache key. Chunks are TCC body text from the user's own document — same
  trust boundary as the chat history they already store.

## Do not do

- Do not import `google-genai` SDK. Stay on `httpx`.
- Do not write a Redis client factory; reuse what `app/quota/` already wires up.
- Do not touch `app/orchestrator/`, `app/api/`, Alembic migrations, Prisma, or the BFF.
- Do not store cache entries without a TTL.
- Do not hit `:embedContent` (single) when a batch is available; only `:batchEmbedContents`.
- Do not retry on `4xx` other than `429`.
- Do not push the branch. Do not open the PR. Local commit only.

## Definition of done

Verifiable file checks:

- `test -f services/ai/app/providers/embedding.py`
- `test -f services/ai/app/rag/embedding_cache.py`
- `test -f services/ai/app/rag/embedder.py`
- `test -f services/ai/tests/providers/test_embedding.py`
- `test -f services/ai/tests/providers/test_embedding_factory.py`
- `test -f services/ai/tests/rag/test_embedding_cache.py`
- `test -f services/ai/tests/rag/test_embedder.py`
- `grep -q 'class EmbeddingProvider(Protocol)' services/ai/app/providers/embedding.py`
- `grep -q 'text-embedding-004' services/ai/app/providers/embedding.py`
- `grep -q 'GOOGLE_EMBED_DIM: Final\[int\] = 768' services/ai/app/providers/embedding.py`
- `grep -q 'def get_embedding_provider' services/ai/app/providers/embedding.py`
- `grep -q 'Embedding provider' services/ai/README.md`

Behavioral checks (covered by the new tests, must pass):

- Happy path embeds N texts and returns N vectors each of dim 768.
- Batches of >100 split into multiple `:batchEmbedContents` calls.
- Transient 429 followed by 200 succeeds without raising.
- Persistent 429 raises `EmbeddingRateLimited` after `max_retries + 1` attempts.
- Persistent 5xx raises `EmbeddingUnavailable`.
- Cache hit path does not invoke the HTTP client.
- Output vector order matches input text order across mixed hit/miss.

## Gates

`apps/web` not touched. Skip.

`services/ai` (must all pass before commit):

```bash
cd services/ai
uv sync --extra dev
uv run ruff check .
uv run mypy app
uv run pytest -q
```

Expected: 81 prior tests still green, plus the new tests added in §5. No regressions allowed.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg2-google-embedding
```

Single commit:

```
feat(ai): Google embedding provider + Redis cache (T-G2)

EmbeddingProvider Protocol em app/providers/embedding.py com
GoogleEmbeddingProvider usando text-embedding-004 (dim 768) via
httpx async. Factory get_embedding_provider() env-driven.

Cache Redis em app/rag/embedding_cache.py (embed:{model}:{sha256}
TTL 30d). Glue app/rag/embedder.py orquestra hit/miss + persiste
back ao cache.

Backoff exponencial 4 tentativas com jitter pra 429/5xx. Reusa
GOOGLE_API_KEY e o cliente Redis ja configurado. Sem novo SDK.

Implementa ADR-0008.
```

Do not push. Do not open PR.

## Expected return summary

Report back:

1. Branch name and commit SHA.
2. List of files created/modified with line counts.
3. Output of all four gate commands (`uv sync`, `ruff check`, `mypy`, `pytest -q`).
4. Test count delta (before / after).
5. Sample structlog event payload from one happy-path test run (paste a single log line).
6. Any deviation from this brief with one-line rationale.
```
