from app.rag import chunker


def test_chunk_text_vazio_retorna_lista_vazia() -> None:
    assert chunker.chunk_text(" \n\t ") == []


def test_chunk_text_curto_retorna_chunk_unico_limpo() -> None:
    assert chunker.chunk_text(" texto \n curto  aqui ") == ["texto curto aqui"]


def test_chunk_text_longo_preserva_overlap() -> None:
    text = "x" * (chunker.CHUNK_CHARS * 2)

    chunks = chunker.chunk_text(text)

    assert len(chunks) > 1
    assert all(len(item) <= chunker.CHUNK_CHARS for item in chunks)
    for previous, current in zip(chunks[:-1], chunks[1:], strict=True):
        assert previous[-chunker.CHUNK_OVERLAP_CHARS :] == current[
            : chunker.CHUNK_OVERLAP_CHARS
        ]


def test_chunk_pages_junta_paginas_nao_vazias() -> None:
    assert chunker.chunk_pages(["pagina 1", "", "pagina 2"]) == ["pagina 1 pagina 2"]


def test_approx_token_count_retorna_minimo_um() -> None:
    assert chunker.approx_token_count("") == 1
    assert chunker.approx_token_count("x" * 8) == 2
