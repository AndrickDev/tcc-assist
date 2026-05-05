from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.quota import router as quota_router
from app.auth.exceptions import InvalidToken, MissingToken
from app.db.pool import close_pool
from app.observability.logging import configure_logging
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
    app.include_router(health_router, prefix="/v1")
    app.include_router(quota_router, prefix="/v1")
    return app


configure_logging()
app = create_app()
