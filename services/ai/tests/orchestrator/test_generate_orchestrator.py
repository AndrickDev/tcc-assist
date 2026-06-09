from collections.abc import AsyncIterator, Sequence
from typing import cast

import asyncpg
import fakeredis.aioredis
import pytest
import respx
from redis.asyncio import Redis

from app.orchestrator.exceptions import TccNotFoundOrForbidden
from app.orchestrator.generate import InsufficientSources, run_generate
from app.providers.embedding import EmbeddingProvider, EmbedResult
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL
from app.rag.chat_retrieval import ChatRagChunk


class FakeEmbeddingProvider:
    model = "test-model"
    dim = 3

    async def embed(self, texts: Sequence[str]) -> EmbedResult:
        return EmbedResult(model=self.model, dim=self.dim, vectors=[[1.0, 0.0, 0.0]])


@pytest.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


def _provider() -> EmbeddingProvider:
    return cast(EmbeddingProvider, FakeEmbeddingProvider())


def _rag_chunk(index: int) -> ChatRagChunk:
    return ChatRagChunk(
        chunk_id=f"chunk-{index}",
        source_type="pdf",
        source_ref=f"attachment-{index}",
        ordinal=index,
        content=f"conteudo recuperado {index}",
        score=0.9,
    )


async def test_run_generate_happy_path_com_refs(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "```html\n<p>ok</p>\n```"}]}}]},
        )

        result = await run_generate(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            chapter="Introdução",
            previous_context="Contexto anterior",
            require_sources=True,
        )

    body = route.calls.last.request.content.decode()
    assert result.content == "<p>ok</p>"
    assert result.agent_id == "redator-pro"
    assert result.chapter == "Introdução"
    assert result.references_used == 3
    assert result.citations == []
    assert "REFERÊNCIAS SELECIONADAS" in body
    assert "CONTEXTO ANTERIOR DO TCC" in body


async def test_run_generate_inclui_rag_contexto_e_citations(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    async def retrieve_for_chat(
        *,
        pool: asyncpg.Pool,
        redis: Redis,
        provider: EmbeddingProvider,
        tcc_id: str,
        query: str,
    ) -> list[ChatRagChunk]:
        return [_rag_chunk(1), _rag_chunk(2)]

    monkeypatch.setattr("app.orchestrator.generate.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "<p>ok</p>"}]}}]},
        )

        result = await run_generate(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            chapter="Referencial teórico",
            previous_context=None,
            require_sources=True,
        )

    body = route.calls.last.request.content.decode()
    assert "CONTEXTO RECUPERADO" in body
    assert "conteudo recuperado 1" in body
    assert len(result.citations) == 2
    assert result.citations[0].chunk_id == "chunk-1"


async def test_run_generate_require_sources_true_sem_base_levanta_422(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    async def retrieve_for_chat(
        *,
        pool: asyncpg.Pool,
        redis: Redis,
        provider: EmbeddingProvider,
        tcc_id: str,
        query: str,
    ) -> list[ChatRagChunk]:
        return []

    monkeypatch.setattr("app.orchestrator.generate.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        gemini_route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "nao deve chamar"}]}}]},
        )

        with pytest.raises(InsufficientSources):
            await run_generate(
                pool=postgres_pool,
                redis_client=cast(Redis, fake_redis),
                provider=_provider(),
                user_id="user-1",
                plan="PRO",
                tcc_id="tcc-empty",
                chapter="Introdução",
                previous_context=None,
                require_sources=True,
            )

    assert not gemini_route.called


async def test_run_generate_require_sources_false_sem_rag_gera_mesmo_assim(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    async def retrieve_for_chat(
        *,
        pool: asyncpg.Pool,
        redis: Redis,
        provider: EmbeddingProvider,
        tcc_id: str,
        query: str,
    ) -> list[ChatRagChunk]:
        raise RuntimeError("boom")

    monkeypatch.setattr("app.orchestrator.generate.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "<p>sem fontes</p>"}]}}]},
        )

        result = await run_generate(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-empty",
            chapter="Introdução",
            previous_context=None,
            require_sources=False,
        )

    body = route.calls.last.request.content.decode()
    assert result.content == "<p>sem fontes</p>"
    assert result.references_used == 0
    assert result.citations == []
    assert "CONTEXTO RECUPERADO" not in body
    assert "REFERÊNCIAS SELECIONADAS" not in body


async def test_run_generate_tcc_de_outro_user_levanta_forbidden(
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    with pytest.raises(TccNotFoundOrForbidden):
        await run_generate(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-2",
            plan="PRO",
            tcc_id="tcc-1",
            chapter="Introdução",
            previous_context=None,
            require_sources=False,
        )
