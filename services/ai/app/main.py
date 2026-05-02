from fastapi import FastAPI

from app.api.health import router as health_router
from app.observability.logging import configure_logging


def create_app() -> FastAPI:
    app = FastAPI(
        title="TCC-Assist AI",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.include_router(health_router, prefix="/v1")
    return app


configure_logging()
app = create_app()
