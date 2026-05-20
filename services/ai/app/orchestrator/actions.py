from time import perf_counter

import asyncpg
import structlog
from pydantic import BaseModel, ConfigDict

from app.db.tcc_repo import get_tcc_metadata
from app.orchestrator.exceptions import TccNotFoundOrForbidden
from app.prompts.actions import Action, ActionPromptInput, build_action_prompt
from app.prompts.chat import Plan
from app.providers.gemini import generate, get_config_for_plan
from app.providers.postprocess import strip_code_fences

log = structlog.get_logger(__name__)


class ActionResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    result: str


class FreePlanForbidden(Exception):
    """Raised when a FREE plan user requests an action endpoint."""


async def run_action(
    *,
    pool: asyncpg.Pool,
    user_id: str,
    plan: Plan,
    tcc_id: str,
    action: Action,
    text: str,
    context: str | None,
) -> ActionResult:
    started = perf_counter()
    log.info("action_started", user_id=user_id, plan=plan, tcc_id=tcc_id, action=action)
    try:
        if plan == "FREE":
            raise FreePlanForbidden

        tcc_metadata = await get_tcc_metadata(pool=pool, tcc_id=tcc_id, user_id=user_id)
        if tcc_metadata is None:
            raise TccNotFoundOrForbidden("tcc_not_found")

        prompt = build_action_prompt(
            ActionPromptInput(action=action, plan=plan, text=text, context=context)
        )
        raw = await generate(prompt=prompt, config=get_config_for_plan(plan))
        result = ActionResult(result=strip_code_fences(raw))

        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info(
            "action_completed",
            user_id=user_id,
            plan=plan,
            tcc_id=tcc_id,
            action=action,
            latency_ms=latency_ms,
        )
        return result
    except Exception:
        latency_ms = round((perf_counter() - started) * 1000, 3)
        log.info(
            "action_failed",
            user_id=user_id,
            plan=plan,
            tcc_id=tcc_id,
            action=action,
            latency_ms=latency_ms,
        )
        raise
