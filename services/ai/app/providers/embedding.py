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
GOOGLE_EMBED_MAX_BATCH: Final[int] = 100

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
    """Embeddings via Google Generative AI text-embedding-004."""

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

        if any(len(vector) != self.dim for vector in vectors):
            raise EmbeddingBadResponse(
                f"dimensao inesperada esperado={self.dim} "
                f"recebido={[len(vector) for vector in vectors]}"
            )
        return EmbedResult(model=self.model, dim=self.dim, vectors=vectors)

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        url = (
            f"{GOOGLE_EMBED_BASE_URL}/models/{self.model}:batchEmbedContents"
            f"?key={self._api_key}"
        )
        payload: dict[str, object] = {
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
        except (KeyError, ValueError, TypeError) as exc:
            raise EmbeddingBadResponse(f"payload Google invalido: {exc}") from exc

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
            except httpx.RequestError as exc:
                last_exc = exc
                log.warning(
                    "embed_http_error",
                    attempt=attempt,
                    error=str(exc),
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
        raise EmbeddingUnavailable(str(last_exc)) from last_exc


def get_embedding_provider() -> EmbeddingProvider:
    """Return env-selected embedding provider."""

    name = os.environ.get("EMBEDDING_PROVIDER", "google").strip().lower()
    if name == "google":
        return GoogleEmbeddingProvider()
    raise EmbeddingUnavailable(f"EMBEDDING_PROVIDER desconhecido: {name!r}")
