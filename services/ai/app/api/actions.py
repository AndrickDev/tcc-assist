from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import require_scope
from app.auth.jwt import InternalClaims
from app.db.deps import get_pool_dep
from app.orchestrator.actions import ActionResult, run_action
from app.prompts.actions import Action

router = APIRouter(tags=["actions"])


class ActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tcc_id: str
    text: str = Field(min_length=1, max_length=200000)
    context: str | None = Field(default=None, max_length=8000)


class ActionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    result: str


@router.post("/actions/{action}", response_model=ActionResponse)
async def perform_action(
    request: ActionRequest,
    claims: Annotated[InternalClaims, Depends(require_scope("action"))],
    pool: Annotated[asyncpg.Pool, Depends(get_pool_dep)],
    action: Annotated[Action, Path()],
) -> ActionResponse | JSONResponse:
    if claims.tcc_id != request.tcc_id:
        return JSONResponse(status_code=403, content={"error": "tcc_id_mismatch"})

    result: ActionResult = await run_action(
        pool=pool,
        user_id=claims.sub,
        plan=claims.plan,
        tcc_id=request.tcc_id,
        action=action,
        text=request.text,
        context=request.context,
    )
    return ActionResponse(result=result.result)
