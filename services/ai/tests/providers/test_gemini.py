import asyncio

import httpx
import pytest
import respx

from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL, GeminiConfig, generate

GEMINI_URL = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"
CONFIG = GeminiConfig(temperature=0.1, max_output_tokens=2000)


def test_generate_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "texto gerado"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "texto gerado"


def test_generate_500_levanta_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(500, json={})

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_500"


def test_generate_timeout_levanta_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").mock(
            side_effect=httpx.TimeoutException("timeout")
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "network"


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
