class ProviderError(Exception):
    """Base exception for provider errors."""


class GeminiUnavailable(ProviderError):
    """Raised when Gemini cannot serve a generation request."""


class GeminiBadResponse(ProviderError):
    """Raised when Gemini returns an unexpected payload."""


class EmbeddingUnavailable(ProviderError):
    """Raised when the embedding backend cannot serve a request (network, 5xx)."""


class EmbeddingRateLimited(ProviderError):
    """Raised when the embedding backend signals rate limiting (429) after retries."""


class EmbeddingBadResponse(ProviderError):
    """Raised when the embedding backend returns an unexpected payload shape."""
