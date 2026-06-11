import asyncio
import os
from time import perf_counter
from typing import Final, Literal, cast

import httpx
import structlog
from pydantic import BaseModel, ConfigDict

from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable

GEMINI_MODEL: Final[str] = "gemini-flash-latest"
GEMINI_FALLBACK_MODEL: Final[str] = "gemini-2.0-flash"
GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta"
MAX_GENERATE_ATTEMPTS: Final[int] = 3
GENERATE_RETRY_BACKOFFS: Final[tuple[float, ...]] = (0.8, 1.6)
GENERATE_TIMEOUT_S: Final[float] = 25.0
RETRYABLE_GENERATE_STATUS_CODES: Final[frozenset[int]] = frozenset({429, 500, 502, 503, 504})

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

    body: dict[str, object] = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": config.temperature,
            "maxOutputTokens": config.max_output_tokens,
        },
    }

    primary_model = _get_env("GEMINI_GENERATE_MODEL", GEMINI_MODEL)
    fallback_model = _get_env("GEMINI_GENERATE_FALLBACK_MODEL", GEMINI_FALLBACK_MODEL)
    timeout_s = _get_generate_timeout_s()

    if client is not None:
        return await _generate_with_client(
            client=client,
            api_key=api_key,
            body=body,
            config=config,
            primary_model=primary_model,
            fallback_model=fallback_model,
            timeout_s=timeout_s,
        )

    async with httpx.AsyncClient(timeout=timeout_s) as owned_client:
        return await _generate_with_client(
            client=owned_client,
            api_key=api_key,
            body=body,
            config=config,
            primary_model=primary_model,
            fallback_model=fallback_model,
            timeout_s=timeout_s,
        )


async def _generate_with_client(
    *,
    client: httpx.AsyncClient,
    api_key: str,
    body: dict[str, object],
    config: GeminiConfig,
    primary_model: str,
    fallback_model: str,
    timeout_s: float,
) -> str:
    for attempt, model in enumerate(
        _generate_attempt_models(primary_model=primary_model, fallback_model=fallback_model),
        start=1,
    ):
        fallback_used = model != primary_model
        url = f"{GEMINI_BASE_URL}/models/{model}:generateContent?key={api_key}"
        started = perf_counter()
        status = "network"
        try:
            response = await client.post(url, json=body, timeout=timeout_s)
            status = str(response.status_code)
        except httpx.HTTPError as exc:
            _log_call(
                started=started,
                status=status,
                config=config,
                attempt=attempt,
                model=model,
                fallback_used=fallback_used,
            )
            if attempt == MAX_GENERATE_ATTEMPTS:
                raise GeminiUnavailable("network") from exc
            await asyncio.sleep(GENERATE_RETRY_BACKOFFS[attempt - 1])
            continue

        _log_call(
            started=started,
            status=status,
            config=config,
            attempt=attempt,
            model=model,
            fallback_used=fallback_used,
        )
        if not 200 <= response.status_code < 300:
            if (
                response.status_code in RETRYABLE_GENERATE_STATUS_CODES
                and attempt < MAX_GENERATE_ATTEMPTS
            ):
                await asyncio.sleep(GENERATE_RETRY_BACKOFFS[attempt - 1])
                continue
            raise GeminiUnavailable(f"http_{response.status_code}")
        break

    try:
        payload = cast(object, response.json())
    except ValueError as exc:
        raise GeminiBadResponse("missing_text") from exc

    return _extract_text(payload)


def _get_env(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped or default


def _get_generate_timeout_s() -> float:
    raw = os.environ.get("GEMINI_GENERATE_TIMEOUT_S")
    if raw is None:
        return GENERATE_TIMEOUT_S
    try:
        timeout_s = float(raw)
    except ValueError:
        return GENERATE_TIMEOUT_S
    if timeout_s <= 0:
        return GENERATE_TIMEOUT_S
    return timeout_s


def _generate_attempt_models(*, primary_model: str, fallback_model: str) -> tuple[str, str, str]:
    return (primary_model, fallback_model, fallback_model)


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


def _log_call(
    *,
    started: float,
    status: str,
    config: GeminiConfig,
    attempt: int,
    model: str,
    fallback_used: bool,
) -> None:
    latency_ms = round((perf_counter() - started) * 1000, 3)
    log.info(
        "gemini_call",
        attempt=attempt,
        model=model,
        latency_ms=latency_ms,
        status=status,
        fallback_used=fallback_used,
        tokens_max=config.max_output_tokens,
    )
