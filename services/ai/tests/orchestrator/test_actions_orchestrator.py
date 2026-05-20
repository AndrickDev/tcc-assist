from typing import cast

import asyncpg
import pytest

from app.orchestrator import actions as actions_module
from app.orchestrator.actions import FreePlanForbidden, run_action
from app.orchestrator.exceptions import TccNotFoundOrForbidden
from app.providers.gemini import GeminiConfig


async def test_run_action_free_levanta_forbidden_sem_consultar_tcc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = False

    async def fake_get_tcc_metadata(**_kwargs: object) -> object:
        nonlocal called
        called = True
        return object()

    monkeypatch.setattr(actions_module, "get_tcc_metadata", fake_get_tcc_metadata)

    with pytest.raises(FreePlanForbidden):
        await run_action(
            pool=cast(asyncpg.Pool, object()),
            user_id="user-1",
            plan="FREE",
            tcc_id="tcc-1",
            action="revisar",
            text="<p>x</p>",
            context=None,
        )

    assert not called


async def test_run_action_tcc_nao_pertence_levanta_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_tcc_metadata(**_kwargs: object) -> None:
        return None

    async def fake_generate(*, prompt: str, config: GeminiConfig) -> str:
        raise AssertionError("Gemini não deveria ser chamado")

    monkeypatch.setattr(actions_module, "get_tcc_metadata", fake_get_tcc_metadata)
    monkeypatch.setattr(actions_module, "generate", fake_generate)

    with pytest.raises(TccNotFoundOrForbidden):
        await run_action(
            pool=cast(asyncpg.Pool, object()),
            user_id="user-2",
            plan="PRO",
            tcc_id="tcc-1",
            action="abnt",
            text="<p>x</p>",
            context=None,
        )


async def test_run_action_pro_sucesso_remove_code_fences(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_get_tcc_metadata(**_kwargs: object) -> object:
        return object()

    async def fake_generate(*, prompt: str, config: GeminiConfig) -> str:
        captured["prompt"] = prompt
        captured["temperature"] = str(config.temperature)
        return "```html\n<p>ok</p>\n```"

    monkeypatch.setattr(actions_module, "get_tcc_metadata", fake_get_tcc_metadata)
    monkeypatch.setattr(actions_module, "generate", fake_generate)

    result = await run_action(
        pool=cast(asyncpg.Pool, object()),
        user_id="user-1",
        plan="PRO",
        tcc_id="tcc-1",
        action="citacoes",
        text="<p>Segundo Silva (2020)</p>",
        context="contexto",
    )

    assert result.result == "<p>ok</p>"
    assert "Você é um Especialista em Revisão Bibliográfica." in captured["prompt"]
    assert captured["temperature"]
