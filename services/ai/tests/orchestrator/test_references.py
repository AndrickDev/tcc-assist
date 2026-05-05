from datetime import UTC, datetime

from app.db.models import ReferenceRow
from app.orchestrator.references import abnt_inline_citation, build_references_block


def _ref(
    *,
    id_: str = "ref-1",
    authors: str = "Ana Silva",
    year: int | None = 2024,
    citation_count: int | None = 10,
    abstract: str | None = "Resumo",
) -> ReferenceRow:
    return ReferenceRow(
        id=id_,
        title=f"Titulo {id_}",
        authors=authors,
        year=year,
        source="semantic-scholar",
        abstract=abstract,
        venue="Revista X",
        citation_count=citation_count,
        created_at=datetime(2026, 5, 5, tzinfo=UTC),
    )


def test_abnt_inline_citation_autor_unico() -> None:
    assert abnt_inline_citation(_ref(authors="Ana Silva")) == "(SILVA, 2024)"


def test_abnt_inline_citation_multiplos_autores_virgula() -> None:
    assert abnt_inline_citation(_ref(authors="Ana Silva, João Souza")) == "(SILVA, 2024)"


def test_abnt_inline_citation_multiplos_autores_ponto_virgula() -> None:
    assert abnt_inline_citation(_ref(authors="Ana Silva; João Souza")) == "(SILVA, 2024)"


def test_abnt_inline_citation_sem_year() -> None:
    assert abnt_inline_citation(_ref(year=None)) == "(SILVA)"


def test_build_references_block_vazio_retorna_vazio() -> None:
    assert build_references_block([]) == ""


def test_build_references_block_respeita_max_refs_e_trunca_abstract() -> None:
    refs = [
        _ref(id_="ref-1", citation_count=1, abstract="a" * 20),
        _ref(id_="ref-2", citation_count=3, abstract="b" * 20),
        _ref(id_="ref-3", citation_count=2, abstract="c" * 20),
    ]

    block = build_references_block(refs, max_refs=2, max_abstract_chars=5)

    assert "[1] (SILVA, 2024) — Titulo ref-2" in block
    assert "[2] (SILVA, 2024) — Titulo ref-3" in block
    assert "Titulo ref-1" not in block
    assert "Resumo: bbbbb..." in block
