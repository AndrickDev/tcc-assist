import pytest

from app.providers.embedding import GoogleEmbeddingProvider, get_embedding_provider
from app.providers.exceptions import EmbeddingUnavailable


def test_factory_default_google(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EMBEDDING_PROVIDER", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    provider = get_embedding_provider()

    assert isinstance(provider, GoogleEmbeddingProvider)


def test_factory_google_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMBEDDING_PROVIDER", "google")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    provider = get_embedding_provider()

    assert isinstance(provider, GoogleEmbeddingProvider)


def test_factory_provider_desconhecido_levanta_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EMBEDDING_PROVIDER", "other")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    with pytest.raises(EmbeddingUnavailable) as exc_info:
        get_embedding_provider()

    assert str(exc_info.value) == "EMBEDDING_PROVIDER desconhecido: 'other'"
