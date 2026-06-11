import asyncio

import httpx
import pytest
import respx

from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL, GeminiConfig, generate

GEMINI_URL = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"
CONFIG = GeminiConfig(temperature=0.1, max_output_tokens=2000)


async def _no_sleep(_delay: float) -> None:
    return None


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(asyncio, "sleep", _no_sleep)


def test_generate_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "texto gerado"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "texto gerado"


def test_generate_503_transiente_retried_e_sucesso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").mock(
            side_effect=[
                httpx.Response(503, json={}),
                httpx.Response(
                    200,
                    json={"candidates": [{"content": {"parts": [{"text": "texto gerado"}]}}]},
                ),
            ],
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "texto gerado"
    assert route.call_count == 2


def test_generate_503_persistente_levanta_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_503"
    assert route.call_count == 3


@pytest.mark.parametrize("status_code", [401, 403])
def test_generate_auth_errors_nao_fazem_retry(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            status_code,
            json={},
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == f"http_{status_code}"
    assert route.call_count == 1


def test_generate_500_levanta_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(500, json={})

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_500"
    assert route.call_count == 3


def test_generate_timeout_levanta_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").mock(
            side_effect=httpx.TimeoutException("timeout")
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "network"
    assert route.call_count == 3


def test_generate_payload_sem_candidates_levanta_bad_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(200, json={})

        with pytest.raises(GeminiBadResponse) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "missing_text"


def test_generate_candidates_vazio_levanta_bad_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(200, json={"candidates": []})

        with pytest.raises(GeminiBadResponse) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "missing_text"


def test_generate_sem_api_key_levanta_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "GOOGLE_API_KEY ausente"
