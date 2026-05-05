from typing import cast

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.auth.exceptions import InvalidToken, MissingToken
from app.observability.logging import configure_logging


async def missing_token_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "missing_token"})


async def invalid_token_handler(_request: Request, exc: Exception) -> JSONResponse:
    invalid_token = cast(InvalidToken, exc)
    return JSONResponse(
        status_code=401,
        content={"error": "invalid_token", "detail": invalid_token.detail},
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="TCC-Assist AI",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_exception_handler(MissingToken, missing_token_handler)
    app.add_exception_handler(InvalidToken, invalid_token_handler)
    app.include_router(health_router, prefix="/v1")
    return app


configure_logging()
app = create_app()
