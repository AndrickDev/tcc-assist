class QuotaError(Exception):
    """Base exception for quota errors."""


class QuotaBackendUnavailable(QuotaError):
    """Raised when Redis cannot serve a quota operation."""


class QuotaInvalidPlan(QuotaError):
    """Raised when quota receives an unsupported plan."""

