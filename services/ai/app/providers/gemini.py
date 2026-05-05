import os
from time import perf_counter
from typing import Final, Literal, cast

import httpx
import structlog
from pydantic import BaseModel, ConfigDict

from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable

GEMINI_MODEL: Final[str] = "gemini-flash-latest"
GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta"

Plan = Literal["FREE", "PRO", "VIP"]

log = structlog.get_logger(__name__)


class GeminiConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    temperature: float
    max_output_tokens: int


_PLAN_CONFIGS: Final[dict[Plan, GeminiConfig]] = {
    "FREE": GeminiConfig(temperature=0.1, max_output_tokens=2000),
    "PRO": GeminiConfig(temperature=0.15, max_output_tokens=6000),
    "VIP": GeminiConfig(temperature=0.2, max_output_tokens=16000),
}


def get_config_for_plan(plan: Plan) -> GeminiConfig:
    return _PLAN_CONFIGS[plan]


async def generate(
    *,
    prompt: str,
    config: GeminiConfig,
    client: httpx.AsyncClient | None = None,
) -> str:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY ausente")

    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    body: dict[str, object] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": config.temperature,
            "maxOutputTokens": config.max_output_tokens,
        },
    }

    if client is not None:
        return await _generate_with_client(client=client, url=url, body=body, config=config)

    async with httpx.AsyncClient(timeout=30) as owned_client:
        return await _generate_with_client(client=owned_client, url=url, body=body, config=config)


async def _generate_with_client(
    *,
    client: httpx.AsyncClient,
    url: str,
    body: dict[str, object],
    config: GeminiConfig,
) -> str:
    started = perf_counter()
    status = "network"
    try:
        response = await client.post(url, json=body)
        status = str(response.status_code)
    except httpx.HTTPError as exc:
        _log_call(started=started, status=status, config=config)
        raise GeminiUnavailable("network") from exc

    _log_call(started=started, status=status, config=config)
    if not 200 <= response.status_code < 300:
        raise GeminiUnavailable(f"http_{response.status_code}")

    try:
        payload = cast(object, response.json())
    except ValueError as exc:
        raise GeminiBadResponse("missing_text") from exc

    return _extract_text(payload)


def _extract_text(payload: object) -> str:
    if not isinstance(payload, dict):
        raise GeminiBadResponse("missing_text")

    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise GeminiBadResponse("missing_text")

    first_candidate = candidates[0]
    if not isinstance(first_candidate, dict):
        raise GeminiBadResponse("missing_text")

    content = first_candidate.get("content")
    if not isinstance(content, dict):
        raise GeminiBadResponse("missing_text")

    parts = content.get("parts")
    if not isinstance(parts, list) or not parts:
        raise GeminiBadResponse("missing_text")

    first_part = parts[0]
    if not isinstance(first_part, dict):
        raise GeminiBadResponse("missing_text")

    text = first_part.get("text")
    if not isinstance(text, str):
        raise GeminiBadResponse("missing_text")
    return text


def _log_call(*, started: float, status: str, config: GeminiConfig) -> None:
    latency_ms = round((perf_counter() - started) * 1000, 3)
    log.info(
        "gemini_call",
        latency_ms=latency_ms,
        status=status,
        tokens_max=config.max_output_tokens,
    )
