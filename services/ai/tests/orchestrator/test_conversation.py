from datetime import UTC, datetime, timedelta

from app.db.models import MessageRow
from app.orchestrator.conversation import build_conversation_block, messages_limit_for_plan


def _messages(count: int) -> list[MessageRow]:
    base = datetime(2026, 5, 5, tzinfo=UTC)
    return [
        MessageRow(
            id=f"msg-{index}",
            role="user",
            content=f"conteudo-{index}",
            created_at=base - timedelta(minutes=index),
        )
        for index in range(count)
    ]


def test_messages_limit_for_plan() -> None:
    assert messages_limit_for_plan("FREE") == 0
    assert messages_limit_for_plan("PRO") == 3
    assert messages_limit_for_plan("VIP") == 8


def test_build_conversation_block_free_retorna_vazio() -> None:
    assert build_conversation_block("FREE", _messages(5)) == ""


def test_build_conversation_block_pro_usa_3_em_ordem_cronologica() -> None:
    block = build_conversation_block("PRO", _messages(5))

    assert "[CONTEXTO RECENTE DO CAPÍTULO]" in block
    assert block.index("conteudo-2") < block.index("conteudo-1") < block.index("conteudo-0")
    assert "conteudo-3" not in block


def test_build_conversation_block_vip_usa_8() -> None:
    block = build_conversation_block("VIP", _messages(10))

    assert "[CONSISTÊNCIA GLOBAL - HISTÓRICO RECENTE DO TCC]" in block
    assert "[FIM CONSISTÊNCIA GLOBAL]" in block
    assert "conteudo-7" in block
    assert "conteudo-8" not in block
