import asyncio

import httpx
import pytest
import respx

from app.providers.embedding import (
    GOOGLE_EMBED_BASE_URL,
    GOOGLE_EMBED_DIM,
    GOOGLE_EMBED_MODEL,
    GoogleEmbeddingProvider,
)
from app.providers.exceptions import (
    EmbeddingBadResponse,
    EmbeddingRateLimited,
    EmbeddingUnavailable,
)


async def _no_sleep(_delay: float) -> None:
    return None


def _payload(count: int, *, dim: int = GOOGLE_EMBED_DIM) -> dict[str, list[dict[str, list[float]]]]:
    return {"embeddings": [{"values": [float(index)] * dim} for index in range(count)]}


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(asyncio, "sleep", _no_sleep)


async def test_embed_happy_path_single_batch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").respond(
            200,
            json=_payload(2),
        )

        result = await GoogleEmbeddingProvider().embed(["um", "dois"])

    assert result.model == GOOGLE_EMBED_MODEL
    assert result.dim == GOOGLE_EMBED_DIM
    assert len(result.vectors) == 2
    assert all(len(vector) == GOOGLE_EMBED_DIM for vector in result.vectors)
    assert route.call_count == 1


async def test_embed_happy_path_split_maior_que_cem(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    texts = [f"texto-{index}" for index in range(101)]
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").mock(
            side_effect=[
                httpx.Response(200, json=_payload(100)),
                httpx.Response(200, json=_payload(1)),
            ],
        )

        result = await GoogleEmbeddingProvider().embed(texts)

    assert len(result.vectors) == 101
    assert route.call_count == 2


async def test_embed_429_transiente_retried_e_sucesso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").mock(
            side_effect=[
                httpx.Response(429, json={}),
                httpx.Response(200, json=_payload(1)),
            ],
        )

        result = await GoogleEmbeddingProvider().embed(["texto"])

    assert len(result.vectors) == 1
    assert route.call_count == 2


async def test_embed_429_persistente_levanta_rate_limited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").respond(
            429,
            json={},
        )

        with pytest.raises(EmbeddingRateLimited):
            await GoogleEmbeddingProvider().embed(["texto"])

    assert route.call_count == 5


async def test_embed_503_persistente_levanta_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").respond(
            503,
            json={},
        )

        with pytest.raises(EmbeddingUnavailable):
            await GoogleEmbeddingProvider().embed(["texto"])

    assert route.call_count == 5


async def test_embed_input_vazio_retorna_result_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    result = await GoogleEmbeddingProvider().embed([])

    assert result.model == GOOGLE_EMBED_MODEL
    assert result.dim == GOOGLE_EMBED_DIM
    assert result.vectors == []


async def test_embed_dim_errada_levanta_bad_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        router.post(f"/models/{GOOGLE_EMBED_MODEL}:batchEmbedContents").respond(
            200,
            json=_payload(1, dim=3),
        )

        with pytest.raises(EmbeddingBadResponse):
            await GoogleEmbeddingProvider().embed(["texto"])


def test_embed_sem_api_key_levanta_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    with pytest.raises(EmbeddingUnavailable) as exc_info:
        GoogleEmbeddingProvider()

    assert str(exc_info.value) == "GOOGLE_API_KEY ausente"
