class ProviderError(Exception):
    """Base exception for provider errors."""


class GeminiUnavailable(ProviderError):
    """Raised when Gemini cannot serve a generation request."""


class GeminiBadResponse(ProviderError):
    """Raised when Gemini returns an unexpected payload."""
