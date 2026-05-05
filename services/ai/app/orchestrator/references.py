import re

from app.db.models import ReferenceRow


def abnt_inline_citation(ref: ReferenceRow) -> str:
    surname = _first_author_surname(ref.authors)
    if ref.year is None:
        return f"({surname})"
    return f"({surname}, {ref.year})"


def build_references_block(
    refs: list[ReferenceRow],
    max_refs: int = 10,
    max_abstract_chars: int = 400,
) -> str:
    if not refs:
        return ""

    sorted_refs = sorted(
        refs,
        key=lambda ref: (
            ref.citation_count is None,
            -(ref.citation_count or 0),
            -ref.created_at.timestamp(),
        ),
    )[:max_refs]

    lines = [
        "[REFERÊNCIAS SELECIONADAS PARA ESTE TCC — USO OBRIGATÓRIO]",
        f"Você DEVE usar EXCLUSIVAMENTE as {len(sorted_refs)} referências abaixo. É PROIBIDO "
        "inventar autores, obras ou fontes fictícias.",
        "Sempre que uma afirmação do texto puder se apoiar em uma delas, cite no formato ABNT "
        "autor-data: (SOBRENOME, ANO).",
        "Não é obrigatório citar todas; use as que fizerem sentido no contexto do capítulo.",
        "Se o tema do capítulo não combinar com NENHUMA das referências listadas, escreva sem "
        "citação em vez de inventar.",
        "",
    ]

    for index, ref in enumerate(sorted_refs, start=1):
        lines.append(f"[{index}] {abnt_inline_citation(ref)} — {ref.title}")
        lines.append(f"    Autores: {ref.authors}")
        if ref.venue:
            lines.append(f"    Veículo: {ref.venue}")
        if ref.abstract:
            lines.append(f"    Resumo: {_truncate(ref.abstract, max_abstract_chars)}")

    block = "\n".join(lines)
    return f"\n{block}\n"


def _first_author_surname(authors: str) -> str:
    first_author = re.split(r"[,;]", authors, maxsplit=1)[0].strip()
    if not first_author:
        return "AUTOR"
    tokens = first_author.split()
    return tokens[-1].upper()


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars].rstrip()}..."
