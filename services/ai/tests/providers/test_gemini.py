import asyncio

import httpx
import pytest
import respx

from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable
from app.providers.gemini import (
    GEMINI_BASE_URL,
    GEMINI_FALLBACK_MODEL,
    GEMINI_MODEL,
    GeminiConfig,
    generate,
)

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
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "texto gerado"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "texto gerado"
    assert primary.call_count == 1
    assert fallback.call_count == 1


def test_generate_primary_503_fallback_200_sucesso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "fallback ok"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "fallback ok"
    assert primary.call_count == 1
    assert fallback.call_count == 1


def test_generate_503_persistente_levanta_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            503,
            json={},
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_503"
    assert primary.call_count == 1
    assert fallback.call_count == 2


def test_generate_primary_503_fallback_503_levanta_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            503,
            json={},
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_503"
    assert primary.call_count == 1
    assert fallback.call_count == 2


@pytest.mark.parametrize("status_code", [401, 403])
def test_generate_auth_errors_nao_fazem_retry(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            status_code,
            json={},
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == f"http_{status_code}"
    assert primary.call_count == 1


def test_generate_500_levanta_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(500, json={})
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            500,
            json={},
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "http_500"
    assert primary.call_count == 1
    assert fallback.call_count == 2


def test_generate_timeout_levanta_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").mock(
            side_effect=httpx.TimeoutException("timeout")
        )

        with pytest.raises(GeminiUnavailable) as exc_info:
            asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert str(exc_info.value) == "network"
    assert primary.call_count == 1
    assert fallback.call_count == 2


def test_generate_timeout_no_primary_usa_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        primary = router.post(f"/models/{GEMINI_MODEL}:generateContent").mock(
            side_effect=httpx.TimeoutException("timeout")
        )
        fallback = router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "fallback ok"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "fallback ok"
    assert primary.call_count == 1
    assert fallback.call_count == 1


def test_generate_logs_model_fallback_sem_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-secret-key")
    logs: list[dict[str, object]] = []

    class FakeLog:
        def info(self, event: str, **kwargs: object) -> None:
            logs.append({"event": event, **kwargs})

    monkeypatch.setattr("app.providers.gemini.log", FakeLog())

    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(503, json={})
        router.post(f"/models/{GEMINI_FALLBACK_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "fallback ok"}]}}]},
        )

        result = asyncio.run(generate(prompt="prompt", config=CONFIG))

    assert result == "fallback ok"
    assert logs == [
        {
            "event": "gemini_call",
            "attempt": 1,
            "model": GEMINI_MODEL,
            "latency_ms": logs[0]["latency_ms"],
            "status": "503",
            "fallback_used": False,
            "tokens_max": CONFIG.max_output_tokens,
        },
        {
            "event": "gemini_call",
            "attempt": 2,
            "model": GEMINI_FALLBACK_MODEL,
            "latency_ms": logs[1]["latency_ms"],
            "status": "200",
            "fallback_used": True,
            "tokens_max": CONFIG.max_output_tokens,
        },
    ]
    assert "test-secret-key" not in repr(logs)


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
