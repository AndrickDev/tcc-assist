from datetime import datetime


class OrchestratorError(Exception):
    """Base exception for orchestration errors."""


class TccNotFoundOrForbidden(OrchestratorError):
    """Raised when a TCC does not exist or is not owned by the caller."""


class QuotaExceeded(OrchestratorError):
    def __init__(self, *, remaining: int, reset_at: datetime) -> None:
        self.remaining = remaining
        self.reset_at = reset_at
        super().__init__("quota_exceeded")
