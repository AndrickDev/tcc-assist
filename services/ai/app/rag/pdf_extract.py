from __future__ import annotations

import io
from typing import Final

import httpx
import structlog

DEFAULT_TIMEOUT_S: Final[float] = 30.0
MAX_PDF_BYTES: Final[int] = 25 * 1024 * 1024

log = structlog.get_logger(__name__)


class PdfDownloadError(Exception):
    """Raised when the PDF cannot be downloaded."""


class PdfExtractError(Exception):
    """Raised when text extraction fails."""


async def fetch_pdf(url: str, *, client: httpx.AsyncClient | None = None) -> bytes:
    owns = client is None
    inner = client or httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S, follow_redirects=True)
    try:
        response = await inner.get(url)
    except httpx.RequestError as exc:
        raise PdfDownloadError(f"network: {exc}") from exc
    finally:
        if owns:
            await inner.aclose()

    if response.status_code != 200:
        raise PdfDownloadError(f"http_{response.status_code}")
    if len(response.content) > MAX_PDF_BYTES:
        raise PdfDownloadError(f"oversize: {len(response.content)} bytes")
    return response.content


def extract_pages(data: bytes) -> list[str]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text.strip())
        return pages
    except Exception as exc:
        raise PdfExtractError(str(exc)) from exc
