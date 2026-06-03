from __future__ import annotations

from collections.abc import Sequence

from app.rag.chat_retrieval import ChatRagChunk


def build_rag_context_block(chunks: Sequence[ChatRagChunk]) -> str:
    if not chunks:
        return ""
    lines = ["\n\nCONTEXTO RECUPERADO (cite com [N] quando usar):"]
    for index, chunk in enumerate(chunks, start=1):
        lines.append(
            f"[{index}] (fonte={chunk.source_type}#{chunk.source_ref[:24]}) {chunk.content}"
        )
    return "\n".join(lines)
