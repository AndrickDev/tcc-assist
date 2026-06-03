from collections.abc import AsyncIterator, Sequence
from datetime import UTC, datetime
from typing import cast

import asyncpg
import fakeredis.aioredis
import pytest
import respx
from redis.asyncio import Redis

from app.orchestrator.chat import run_chat
from app.orchestrator.exceptions import QuotaExceeded, TccNotFoundOrForbidden
from app.providers.embedding import EmbeddingProvider, EmbedResult
from app.providers.exceptions import GeminiUnavailable
from app.providers.gemini import GEMINI_BASE_URL, GEMINI_MODEL
from app.rag.chat_retrieval import ChatRagChunk

SECRET = "test-secret-with-at-least-32-bytes"


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


def _quota_key(user_id: str) -> str:
    return f"quota:{user_id}:{datetime.now(UTC).strftime('%Y-%m-%d')}"


def _provider() -> EmbeddingProvider:
    return cast(EmbeddingProvider, FakeEmbeddingProvider())


def _rag_chunk(index: int, content: str | None = None) -> ChatRagChunk:
    return ChatRagChunk(
        chunk_id=f"chunk-{index}",
        source_type="pdf",
        source_ref=f"attachment-{index}",
        ordinal=index,
        content=content or f"conteudo recuperado {index}",
        score=0.9 - (index * 0.1),
    )


async def test_run_chat_happy_path_pro(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "```html\n<p>ok</p>\n```"}]}}]},
        )

        result = await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    assert result.content == "<p>ok</p>"
    assert result.agent_id == "redator-pro"
    assert result.quota.used == 1
    assert result.quota.remaining == 49


async def test_run_chat_tcc_de_outro_user_levanta_forbidden(
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    with pytest.raises(TccNotFoundOrForbidden):
        await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-2",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )


async def test_run_chat_quota_free_excedida_nao_chama_gemini(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    await fake_redis.set(_quota_key("user-1"), "3")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        gemini_route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "nao deve chamar"}]}}]},
        )

        with pytest.raises(QuotaExceeded):
            await run_chat(
                pool=postgres_pool,
                redis_client=cast(Redis, fake_redis),
                provider=_provider(),
                user_id="user-1",
                plan="FREE",
                tcc_id="tcc-1",
                message="Escreva intro",
            )

    assert not gemini_route.called


async def test_run_chat_gemini_500_propaga_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(500, json={})

        with pytest.raises(GeminiUnavailable):
            await run_chat(
                pool=postgres_pool,
                redis_client=cast(Redis, fake_redis),
                provider=_provider(),
                user_id="user-1",
                plan="PRO",
                tcc_id="tcc-1",
                message="Escreva intro",
            )


async def test_run_chat_free_nao_inclui_contexto_conversa(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="FREE",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    body = route.calls.last.request.content.decode()
    assert "CONTEXTO RECENTE DO CAPÍTULO" not in body
    assert "CONSISTÊNCIA GLOBAL" not in body


async def test_run_chat_vip_inclui_contexto_global(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="VIP",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    body = route.calls.last.request.content.decode()
    assert "CONSISTÊNCIA GLOBAL - HISTÓRICO RECENTE DO TCC" in body


async def test_chat_inclui_rag_context_no_prompt(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    rag_chunks = [_rag_chunk(1), _rag_chunk(2)]

    async def retrieve_for_chat(
        *,
        pool: asyncpg.Pool,
        redis: Redis,
        provider: EmbeddingProvider,
        tcc_id: str,
        query: str,
    ) -> list[ChatRagChunk]:
        return rag_chunks

    monkeypatch.setattr("app.orchestrator.chat.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    body = route.calls.last.request.content.decode()
    assert "CONTEXTO RECUPERADO" in body
    assert "conteudo recuperado 1" in body
    assert "conteudo recuperado 2" in body


async def test_chat_sem_chunks_nao_inclui_bloco_rag(
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

    monkeypatch.setattr("app.orchestrator.chat.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    body = route.calls.last.request.content.decode()
    assert "CONTEXTO RECUPERADO" not in body


async def test_chat_result_inclui_citations(
    monkeypatch: pytest.MonkeyPatch,
    postgres_pool: asyncpg.Pool,
    fake_redis: fakeredis.aioredis.FakeRedis,
) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    long_content = "x" * 250

    async def retrieve_for_chat(
        *,
        pool: asyncpg.Pool,
        redis: Redis,
        provider: EmbeddingProvider,
        tcc_id: str,
        query: str,
    ) -> list[ChatRagChunk]:
        return [_rag_chunk(1, long_content), _rag_chunk(2)]

    monkeypatch.setattr("app.orchestrator.chat.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        result = await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    assert len(result.citations) == 2
    assert [citation.n for citation in result.citations] == [1, 2]
    assert result.citations[0].excerpt == long_content[:200]


async def test_chat_rag_falha_nao_quebra_chat(
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

    monkeypatch.setattr("app.orchestrator.chat.retrieve_for_chat", retrieve_for_chat)
    with respx.mock(base_url=GEMINI_BASE_URL) as router:
        route = router.post(f"/models/{GEMINI_MODEL}:generateContent").respond(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

        result = await run_chat(
            pool=postgres_pool,
            redis_client=cast(Redis, fake_redis),
            provider=_provider(),
            user_id="user-1",
            plan="PRO",
            tcc_id="tcc-1",
            message="Escreva intro",
        )

    body = route.calls.last.request.content.decode()
    assert result.content == "ok"
    assert result.citations == []
    assert "CONTEXTO RECUPERADO" not in body
