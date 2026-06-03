from app.orchestrator.rag_block import build_rag_context_block
from app.rag.chat_retrieval import ChatRagChunk


def _chunk(index: int) -> ChatRagChunk:
    return ChatRagChunk(
        chunk_id=f"chunk-{index}",
        source_type="pdf",
        source_ref=f"attachment-{index}",
        ordinal=index,
        content=f"conteudo {index}",
        score=0.9,
    )


def test_build_rag_context_block_lista_numerada() -> None:
    block = build_rag_context_block([_chunk(1), _chunk(2), _chunk(3)])

    assert "CONTEXTO RECUPERADO" in block
    assert "[1]" in block
    assert "[2]" in block
    assert "[3]" in block
    assert "conteudo 1" in block


def test_build_rag_context_block_vazio_retorna_string_vazia() -> None:
    assert build_rag_context_block([]) == ""
