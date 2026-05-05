from app.prompts.chat import (
    GUARDRAILS_GENERATION,
    TccMetadataInput,
    build_chat_prompt,
    get_quality_directive,
    get_writer_system_prompt,
)


def test_get_writer_system_prompt_retorna_textos_diferentes_por_plano() -> None:
    prompts = {
        get_writer_system_prompt("FREE"),
        get_writer_system_prompt("PRO"),
        get_writer_system_prompt("VIP"),
    }

    assert len(prompts) == 3
    assert all(prompt for prompt in prompts)


def test_get_quality_directive_free_retorna_vazio() -> None:
    assert get_quality_directive("FREE") == ""


def test_get_quality_directive_vip_contem_1500() -> None:
    assert "1500" in get_quality_directive("VIP")


def test_build_chat_prompt_sem_metadata_nao_contem_contexto_tcc() -> None:
    prompt = build_chat_prompt(
        plan="FREE",
        tcc_metadata=None,
        references_block="",
        conversation_block="",
        user_message="Escreva a introdução",
    )

    assert "[CONTEXTO DO TCC]" not in prompt


def test_build_chat_prompt_com_metadata_cheia_contem_campos() -> None:
    prompt = build_chat_prompt(
        plan="PRO",
        tcc_metadata=TccMetadataInput(
            title="IA na educação",
            course="Pedagogia",
            institution="UF Teste",
            work_type="Monografia",
            norma="ABNT",
            objective="Analisar impactos",
        ),
        references_block="",
        conversation_block="",
        user_message="Escreva a introdução",
    )

    assert "TEMA DO TCC" in prompt
    assert "CURSO: Pedagogia" in prompt
    assert "INSTITUIÇÃO: UF Teste" in prompt
    assert "TIPO DE TRABALHO: Monografia" in prompt
    assert "NORMA DE FORMATAÇÃO: ABNT" in prompt
    assert "OBJETIVO/PROBLEMA DE PESQUISA: Analisar impactos" in prompt


def test_build_chat_prompt_inclui_guardrails() -> None:
    prompt = build_chat_prompt(
        plan="FREE",
        tcc_metadata=None,
        references_block="",
        conversation_block="",
        user_message="Escreva a introdução",
    )

    assert GUARDRAILS_GENERATION in prompt


def test_build_chat_prompt_user_message_apos_requisito_usuario() -> None:
    prompt = build_chat_prompt(
        plan="FREE",
        tcc_metadata=None,
        references_block="",
        conversation_block="",
        user_message="Escreva a introdução",
    )

    assert "REQUISITO DO USUÁRIO: Escreva a introdução" in prompt
