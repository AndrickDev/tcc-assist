import asyncio
import json
import math

import httpx
import pytest
import respx

from app.providers.embedding import (
    GOOGLE_EMBED_BASE_URL,
    GOOGLE_EMBED_CONCURRENCY,
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


def _embedding(values: list[float]) -> dict[str, dict[str, list[float]]]:
    return {"embedding": {"values": values}}


def _constant_vector(value: float, *, dim: int = GOOGLE_EMBED_DIM) -> list[float]:
    return [value] * dim


def _basis_vector(index: int, *, dim: int = GOOGLE_EMBED_DIM) -> list[float]:
    vector = [0.0] * dim
    vector[index] = 2.0
    return vector


def _norm(vector: list[float]) -> float:
    return math.sqrt(sum(value * value for value in vector))


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(asyncio, "sleep", _no_sleep)


async def test_embed_happy_path_um_texto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    raw = _constant_vector(2.0)
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").respond(
            200,
            json=_embedding(raw),
        )

        result = await GoogleEmbeddingProvider().embed(["um"])

    request_payload = json.loads(route.calls[0].request.content)
    assert request_payload == {
        "model": f"models/{GOOGLE_EMBED_MODEL}",
        "content": {"parts": [{"text": "um"}]},
        "outputDimensionality": GOOGLE_EMBED_DIM,
    }
    assert result.model == "gemini-embedding-001"
    assert result.dim == GOOGLE_EMBED_DIM
    assert len(result.vectors) == 1
    assert len(result.vectors[0]) == GOOGLE_EMBED_DIM
    assert _norm(raw) != pytest.approx(1.0)
    assert _norm(result.vectors[0]) == pytest.approx(1.0)
    assert route.call_count == 1


async def test_embed_multiplos_textos_preserva_ordem(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    texts = [f"texto-{index}" for index in range(15)]

    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        text = payload["content"]["parts"][0]["text"]
        index = int(text.removeprefix("texto-"))
        return httpx.Response(200, json=_embedding(_basis_vector(index)))

    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").mock(
            side_effect=respond,
        )

        result = await GoogleEmbeddingProvider().embed(texts)

    assert GOOGLE_EMBED_CONCURRENCY == 10
    assert route.call_count == 15
    assert len(result.vectors) == 15
    for index, vector in enumerate(result.vectors):
        expected = [0.0] * GOOGLE_EMBED_DIM
        expected[index] = 1.0
        assert vector == pytest.approx(expected)


async def test_embed_429_transiente_retried_e_sucesso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").mock(
            side_effect=[
                httpx.Response(429, json={}),
                httpx.Response(200, json=_embedding(_constant_vector(2.0))),
            ],
        )

        result = await GoogleEmbeddingProvider().embed(["texto"])

    assert len(result.vectors) == 1
    assert _norm(result.vectors[0]) == pytest.approx(1.0)
    assert route.call_count == 2


async def test_embed_429_persistente_levanta_rate_limited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").respond(
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
        route = router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").respond(
            503,
            json={},
        )

        with pytest.raises(EmbeddingUnavailable):
            await GoogleEmbeddingProvider().embed(["texto"])

    assert route.call_count == 5


async def test_embed_input_vazio_retorna_result_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        result = await GoogleEmbeddingProvider().embed([])

    assert result.model == GOOGLE_EMBED_MODEL
    assert result.dim == GOOGLE_EMBED_DIM
    assert result.vectors == []
    assert len(router.calls) == 0


async def test_embed_dim_errada_levanta_bad_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").respond(
            200,
            json=_embedding(_constant_vector(2.0, dim=512)),
        )

        with pytest.raises(EmbeddingBadResponse):
            await GoogleEmbeddingProvider().embed(["texto"])


def test_embed_sem_api_key_levanta_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    with pytest.raises(EmbeddingUnavailable) as exc_info:
        GoogleEmbeddingProvider()

    assert str(exc_info.value) == "GOOGLE_API_KEY ausente"


async def test_embed_vetor_nao_normalizado_sai_normalizado(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    raw = _constant_vector(2.0)
    with respx.mock(base_url=GOOGLE_EMBED_BASE_URL) as router:
        router.post(f"/models/{GOOGLE_EMBED_MODEL}:embedContent").respond(
            200,
            json=_embedding(raw),
        )

        result = await GoogleEmbeddingProvider().embed(["texto"])

    assert _norm(raw) == pytest.approx(55.42562584220407)
    assert _norm(result.vectors[0]) == pytest.approx(1.0)
