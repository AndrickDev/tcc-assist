from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.actions import router as actions_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.quota import router as quota_router
from app.api.retrieve import router as retrieve_router
from app.auth.exceptions import InvalidToken, MissingToken
from app.db.pool import close_pool
from app.observability.logging import configure_logging
from app.orchestrator.actions import FreePlanForbidden
from app.orchestrator.exceptions import QuotaExceeded, TccNotFoundOrForbidden
from app.providers.exceptions import GeminiBadResponse, GeminiUnavailable
from app.quota.exceptions import QuotaBackendUnavailable, QuotaInvalidPlan
from app.quota.redis_client import close_redis


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_pool()
    await close_redis()


async def missing_token_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "missing_token"})


async def invalid_token_handler(_request: Request, exc: Exception) -> JSONResponse:
    invalid_token = cast(InvalidToken, exc)
    return JSONResponse(
        status_code=401,
        content={"error": "invalid_token", "detail": invalid_token.detail},
    )


async def quota_backend_unavailable_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": "quota_backend_unavailable"})


async def quota_invalid_plan_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "invalid_plan"})


async def tcc_not_found_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=404, content={"error": "tcc_not_found"})


async def quota_exceeded_handler(_request: Request, exc: Exception) -> JSONResponse:
    quota_exceeded = cast(QuotaExceeded, exc)
    return JSONResponse(
        status_code=429,
        content={
            "error": "quota_exceeded",
            "remaining": quota_exceeded.remaining,
            "reset_at": quota_exceeded.reset_at.isoformat().replace("+00:00", "Z"),
        },
    )


async def free_plan_forbidden_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=403, content={"error": "free_plan_forbidden"})


async def gemini_unavailable_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": "ai_provider_unavailable"})


async def gemini_bad_response_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=502, content={"error": "ai_provider_bad_response"})


_validation_log = structlog.get_logger("app.validation")


async def request_validation_handler(request: Request, exc: Exception) -> JSONResponse:
    errors = cast(RequestValidationError, exc).errors()
    safe_errors = [
        {"loc": err.get("loc"), "type": err.get("type"), "msg": err.get("msg")}
        for err in errors
    ]
    _validation_log.warning(
        "request_validation_failed",
        path=str(request.url.path),
        method=request.method,
        errors=safe_errors,
    )
    return JSONResponse(
        status_code=422,
        content={"error": "upstream_invalid_request", "detail": safe_errors},
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="TCC-Assist AI",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    app.add_exception_handler(MissingToken, missing_token_handler)
    app.add_exception_handler(InvalidToken, invalid_token_handler)
    app.add_exception_handler(QuotaBackendUnavailable, quota_backend_unavailable_handler)
    app.add_exception_handler(QuotaInvalidPlan, quota_invalid_plan_handler)
    app.add_exception_handler(TccNotFoundOrForbidden, tcc_not_found_handler)
    app.add_exception_handler(QuotaExceeded, quota_exceeded_handler)
    app.add_exception_handler(FreePlanForbidden, free_plan_forbidden_handler)
    app.add_exception_handler(GeminiUnavailable, gemini_unavailable_handler)
    app.add_exception_handler(GeminiBadResponse, gemini_bad_response_handler)
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.include_router(health_router, prefix="/v1")
    app.include_router(quota_router, prefix="/v1")
    app.include_router(chat_router, prefix="/v1")
    app.include_router(actions_router, prefix="/v1")
    app.include_router(ingest_router)
    app.include_router(retrieve_router)
    return app


configure_logging()
app = create_app()
