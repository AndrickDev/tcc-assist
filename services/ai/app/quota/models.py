from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Scope = Literal["chat", "generate", "action"]
PlanName = Literal["FREE", "PRO", "VIP"]


class ConsumeResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    used: int
    allowed: bool
    remaining: int
    reset_at: datetime
    reason: str | None


class QuotaState(BaseModel):
    model_config = ConfigDict(frozen=True)

    used: int
    limit: int
    remaining: int
    reset_at: datetime
