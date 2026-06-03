from __future__ import annotations

from collections.abc import Iterable
from typing import Final

CHUNK_CHARS: Final[int] = 1500
CHUNK_OVERLAP_CHARS: Final[int] = 150
APPROX_CHARS_PER_TOKEN: Final[int] = 4


def chunk_text(text: str) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + CHUNK_CHARS, len(cleaned))
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start = end - CHUNK_OVERLAP_CHARS
    return chunks


def chunk_pages(pages: Iterable[str]) -> list[str]:
    joined = "\n\n".join(page for page in pages if page)
    return chunk_text(joined)


def approx_token_count(text: str) -> int:
    return max(1, len(text) // APPROX_CHARS_PER_TOKEN)
