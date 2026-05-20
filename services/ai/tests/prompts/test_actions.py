import pytest
from pydantic import ValidationError

from app.prompts.actions import ActionPromptInput, build_action_prompt


def test_build_action_prompt_revisar_pro_task_e_texto() -> None:
    prompt = build_action_prompt(
        ActionPromptInput(action="revisar", plan="PRO", text="<p>Texto</p>")
    )

    assert prompt.startswith("Você é um Revisor Acadêmico.")
    assert "Revise apenas a ortografia e gramática" in prompt
    assert "TEXTO_FONTE:\n<p>Texto</p>" in prompt


def test_build_action_prompt_revisar_vip_task_diferente_de_pro() -> None:
    pro = build_action_prompt(ActionPromptInput(action="revisar", plan="PRO", text="x"))
    vip = build_action_prompt(ActionPromptInput(action="revisar", plan="VIP", text="x"))

    assert pro != vip
    assert vip.startswith("Você é um Revisor Acadêmico VIP.")
    assert "revisão crítica profunda" in vip


def test_build_action_prompt_abnt_task() -> None:
    prompt = build_action_prompt(ActionPromptInput(action="abnt", plan="PRO", text="<p>x</p>"))

    assert prompt.startswith("Você é um Especialista em Normas ABNT.")
    assert "NÃO adicione novas citações." in prompt


def test_build_action_prompt_citacoes_task() -> None:
    prompt = build_action_prompt(
        ActionPromptInput(action="citacoes", plan="VIP", text="<p>Segundo Silva (2020)</p>")
    )

    assert prompt.startswith("Você é um Especialista em Revisão Bibliográfica.")
    assert 'ex: "Segundo Silva (2020)..."' in prompt


def test_build_action_prompt_proximopasso_inclui_contexto_e_texto() -> None:
    prompt = build_action_prompt(
        ActionPromptInput(
            action="proximopasso",
            plan="PRO",
            text="<p>Base</p>",
            context="capítulo de metodologia",
        )
    )

    assert prompt.startswith("Com base no contexto do TCC (capítulo de metodologia)")
    assert "NÃO use HTML." in prompt
    assert "TEXTO BASE:\n<p>Base</p>" in prompt


def test_build_action_prompt_inclui_guardrails_para_edicao() -> None:
    prompt = build_action_prompt(ActionPromptInput(action="abnt", plan="PRO", text="x"))

    assert "REGRAS MANDATÓRIAS DE SAÍDA:" in prompt
    assert "ALUCINAÇÃO ZERO" in prompt


def test_build_action_prompt_unknown_action_raises_value_error() -> None:
    input_ = ActionPromptInput.model_construct(action="desconhecida", plan="PRO", text="x")

    with pytest.raises(ValueError, match="unknown_action"):
        build_action_prompt(input_)


def test_action_prompt_input_action_invalida_falha_validacao() -> None:
    with pytest.raises(ValidationError):
        ActionPromptInput(action="desconhecida", plan="PRO", text="x")  # type: ignore[arg-type]
