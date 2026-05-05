import asyncpg

from app.db.tcc_repo import get_tcc_metadata, list_recent_messages, list_selected_references


async def test_get_tcc_metadata_retorna_metadados(postgres_pool: asyncpg.Pool) -> None:
    metadata = await get_tcc_metadata(pool=postgres_pool, tcc_id="tcc-1", user_id="user-1")

    assert metadata is not None
    assert metadata.id == "tcc-1"
    assert metadata.title == "Titulo 1"
    assert metadata.course == "Computacao"
    assert metadata.institution == "UF Teste"
    assert metadata.work_type == "Artigo"
    assert metadata.norma == "ABNT"
    assert metadata.objective == "Objetivo"
    assert metadata.owner_id == "user-1"


async def test_get_tcc_metadata_user_errado_retorna_none(
    postgres_pool: asyncpg.Pool,
) -> None:
    metadata = await get_tcc_metadata(pool=postgres_pool, tcc_id="tcc-1", user_id="user-2")

    assert metadata is None


async def test_list_recent_messages_retorna_limite_em_ordem_desc(
    postgres_pool: asyncpg.Pool,
) -> None:
    messages = await list_recent_messages(pool=postgres_pool, tcc_id="tcc-1", limit=2)

    assert [message.id for message in messages] == ["msg-3", "msg-2"]
    assert [message.content for message in messages] == ["terceira", "segunda"]


async def test_list_selected_references_ordena_por_citacao_e_data(
    postgres_pool: asyncpg.Pool,
) -> None:
    references = await list_selected_references(pool=postgres_pool, tcc_id="tcc-1")

    assert [reference.id for reference in references] == ["ref-2", "ref-1", "ref-4"]
    assert references[0].citation_count == 20
    assert references[0].authors == "Bia"
    assert references[0].abstract == "Resumo alto"
    assert references[0].venue == "Revista B"


async def test_list_recent_messages_vazio_retorna_lista_vazia(
    postgres_pool: asyncpg.Pool,
) -> None:
    messages = await list_recent_messages(pool=postgres_pool, tcc_id="tcc-empty", limit=10)

    assert messages == []
