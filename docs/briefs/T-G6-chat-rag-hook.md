```markdown
# T-G6 Hook RAG retrieval no chat orchestrator

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg6-chat-rag-hook`.
Phase 4 (RAG), última task. Liga ingestion (T-G3/T-G4) + retrieval (T-G5) ao chat:
antes de chamar Gemini, busca chunks relevantes via cosine search, injeta no prompt
como contexto numerado e devolve citações no `ChatResult`.

Scope **só chat**. `actions` (formatar ABNT, próximo passo, etc.) não precisa de RAG —
operam sobre o documento. `generate` (gerar-tcc) ainda está em Phase 5 e ganha hook depois.

ADRs:
- ADR-0001 — orchestrator no FastAPI.
- ADR-0002 — pgvector cosine; vetores normalizados L2.
- ADR-0008 — provider Google.

## Verified state — do not re-infer

- `app/orchestrator/chat.py::run_chat` é o entry point. Estrutura atual:
  1. `get_tcc_metadata`
  2. `consume(quota)` — raise `QuotaExceeded`
  3. `list_selected_references` + `list_recent_messages` em paralelo
  4. `build_chat_prompt(plan, tcc_metadata, references_block, conversation_block, user_message)`
  5. `generate(prompt, config_for_plan)`
  6. `strip_code_fences` + return `ChatResult(content, agent_id, quota)`
- `app/prompts/chat.py::build_chat_prompt` concatena blocos:
  ```
  {writer_system_prompt}{tcc_metadata_block}{references_block}{conversation_block}\n\nREQUISITO DO USUÁRIO: {user_message}
  ```
- `app/rag/repository.py::search_similar_chunks(pool, tcc_id, query_vector, top_k, source_types)`
  retorna `list[dict]` com chunk_id, source_type, source_ref, ordinal, content, metadata, score.
- `app/rag/embedder.py::embed_texts(provider, redis, texts) -> list[list[float]]` é cache-aware
  e reusa o namespace `embed:{model}:{sha256(text)}`. Use-o, não chame provider direto.
- `app/providers/embedding.py::get_embedding_provider()` retorna `EmbeddingProvider`.
- `app/api/retrieve.py` é HTTP-only. O hook do chat NÃO chama o endpoint; usa o repository
  e o embedder diretamente para não pagar serialização nem auth de novo.
- `ChatResult` é `pydantic.BaseModel` com `model_config = ConfigDict(frozen=True)`. Adicionar
  campos novos é compatível enquanto a serialização padrão seguir.
- Provider e Redis já estão disponíveis no `run_chat` (Redis via param `redis_client`; provider
  precisa ser injetado — não está hoje).

Pontos a confirmar pelos verifies:

- `app/api/chat.py` (endpoint) constrói o `run_chat` call. Olhar como passa `redis_client`
  para entender se preciso passar provider também.
- `app/main.py` faz wiring de provider em `get_embedding_provider`. Para o chat, decidir:
  resolver provider dentro do `run_chat` via `get_embedding_provider()` (factory direto, sem
  Depends) OU passar como param.

Decisão neste brief: **passar `provider` como param de `run_chat`**, igual ao padrão de
`redis_client` e `pool`. Mantém consistência e testabilidade.

## Scope

### 1. New module `services/ai/app/rag/chat_retrieval.py`

Alto nível: dado uma query do usuário, devolve chunks pré-filtrados (score threshold +
budget de chars) prontos pra prompt. Não toca em DB direto — composto de embedder +
repository.

```python
from __future__ import annotations

from collections.abc import Sequence
from time import perf_counter
from typing import Final

import asyncpg
import structlog
from pydantic import BaseModel, ConfigDict
from redis.asyncio import Redis

from app.providers.embedding import EmbeddingProvider
from app.rag import embedder, repository

DEFAULT_TOP_K: Final[int] = 5
DEFAULT_SCORE_THRESHOLD: Final[float] = 0.5
DEFAULT_MAX_CHARS: Final[int] = 6000

log = structlog.get_logger(__name__)


class ChatRagChunk(BaseModel):
    model_config = ConfigDict(frozen=True)
    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    content: str
    score: float


async def retrieve_for_chat(
    *,
    pool: asyncpg.Pool,
    redis: Redis,
    provider: EmbeddingProvider,
    tcc_id: str,
    query: str,
    top_k: int = DEFAULT_TOP_K,
    score_threshold: float = DEFAULT_SCORE_THRESHOLD,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> list[ChatRagChunk]:
    """Embed query, search pgvector, filter by score and char budget."""
    started = perf_counter()
    cleaned = query.strip()
    if not cleaned:
        return []
    try:
        vectors = await embedder.embed_texts(provider=provider, redis=redis, texts=[cleaned])
    except Exception as exc:
        log.warning("chat_rag_embed_failed", error=str(exc))
        return []
    if not vectors:
        return []

    try:
        rows = await repository.search_similar_chunks(
            pool,
            tcc_id=tcc_id,
            query_vector=vectors[0],
            top_k=top_k,
        )
    except Exception as exc:
        log.warning("chat_rag_search_failed", tcc_id=tcc_id, error=str(exc))
        return []

    filtered: list[ChatRagChunk] = []
    spent = 0
    for row in rows:
        score = float(row["score"])  # type: ignore[arg-type]
        if score < score_threshold:
            continue
        content = str(row["content"])
        if spent + len(content) > max_chars and filtered:
            break
        filtered.append(
            ChatRagChunk(
                chunk_id=str(row["chunk_id"]),
                source_type=str(row["source_type"]),
                source_ref=str(row["source_ref"]),
                ordinal=int(row["ordinal"]),  # type: ignore[arg-type]
                content=content,
                score=score,
            )
        )
        spent += len(content)

    log.info(
        "chat_rag_retrieved",
        tcc_id=tcc_id,
        candidates=len(rows),
        kept=len(filtered),
        spent_chars=spent,
        elapsed_ms=int((perf_counter() - started) * 1000),
    )
    return filtered
```

Comportamento de falha **intencional**: qualquer erro retorna `[]`. Chat segue sem
contexto RAG — sem regressão funcional. Loga warning para observabilidade.

### 2. New helper em `services/ai/app/orchestrator/rag_block.py`

Converte `list[ChatRagChunk]` em bloco de prompt + objeto de citações.

```python
from __future__ import annotations

from collections.abc import Sequence

from app.rag.chat_retrieval import ChatRagChunk


def build_rag_context_block(chunks: Sequence[ChatRagChunk]) -> str:
    if not chunks:
        return ""
    lines = ["\n\nCONTEXTO RECUPERADO (cite com [N] quando usar):"]
    for index, chunk in enumerate(chunks, start=1):
        lines.append(
            f"[{index}] (fonte={chunk.source_type}#{chunk.source_ref[:24]}) {chunk.content}"
        )
    return "\n".join(lines)
```

Sem novo módulo se o time preferir manter dentro de `chat.py` — o brief permite ambos.
Recomendado o módulo separado para testabilidade.

### 3. Atualizar `services/ai/app/prompts/chat.py::build_chat_prompt`

Adicionar parâmetro **opcional** `rag_context_block: str = ""`. Concatena entre
`references_block` e `conversation_block`. Sem mudança no comportamento atual quando
`rag_context_block == ""`.

```python
def build_chat_prompt(
    *,
    plan: Plan,
    tcc_metadata: TccMetadataInput | None,
    references_block: str,
    conversation_block: str,
    user_message: str,
    rag_context_block: str = "",
) -> str:
    tcc_metadata_block = _build_tcc_metadata_block(tcc_metadata)
    quality_directive = get_quality_directive(plan)
    return (
        f"{get_writer_system_prompt(plan)}"
        f"{tcc_metadata_block}"
        f"{references_block}"
        f"{rag_context_block}"
        f"{conversation_block}"
        f"\n\nREQUISITO DO USUÁRIO: {user_message}"
        # ... resto inalterado (quality_directive etc., se houver)
    )
```

Manter qualquer wrap-up de `quality_directive` ou outros já presentes. Não remover blocos.

### 4. Atualizar `services/ai/app/orchestrator/chat.py::run_chat`

- Aceitar `provider: EmbeddingProvider` como novo parâmetro keyword obrigatório.
- Após `consume(quota)` e em paralelo aos `refs/messages`, disparar
  `retrieve_for_chat(...)`.
- Construir `rag_context_block`.
- Adicionar `citations` ao `ChatResult`.

Diff conceitual do corpo (mantém estrutura):

```python
from app.rag.chat_retrieval import ChatRagChunk, retrieve_for_chat
from app.orchestrator.rag_block import build_rag_context_block


class ChatCitation(BaseModel):
    model_config = ConfigDict(frozen=True)
    n: int
    chunk_id: str
    source_type: str
    source_ref: str
    ordinal: int
    score: float
    excerpt: str


class ChatResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: str
    agent_id: AgentId
    quota: ChatQuotaState
    citations: list[ChatCitation] = []


async def run_chat(
    *,
    pool: asyncpg.Pool,
    redis_client: Redis,
    provider: EmbeddingProvider,
    user_id: str,
    plan: Plan,
    tcc_id: str,
    message: str,
) -> ChatResult:
    ...
    # after consume(quota), gather:
    refs_task = list_selected_references(pool=pool, tcc_id=tcc_id)
    messages_task = (
        list_recent_messages(pool=pool, tcc_id=tcc_id, limit=message_limit)
        if message_limit > 0 else asyncio.sleep(0, result=[])
    )
    rag_task = retrieve_for_chat(
        pool=pool, redis=redis_client, provider=provider,
        tcc_id=tcc_id, query=message,
    )
    refs, recent_messages, rag_chunks = await asyncio.gather(
        refs_task, messages_task, rag_task
    )
    rag_context_block = build_rag_context_block(rag_chunks)

    prompt = build_chat_prompt(
        plan=plan,
        tcc_metadata=_to_prompt_metadata(tcc_metadata),
        references_block=build_references_block(refs),
        conversation_block=build_conversation_block(plan, recent_messages),
        user_message=message,
        rag_context_block=rag_context_block,
    )
    raw_content = await generate(prompt=prompt, config=get_config_for_plan(plan))
    content = strip_code_fences(raw_content)
    citations = _to_citations(rag_chunks)

    result = ChatResult(
        content=content,
        agent_id=_agent_id_for_plan(plan),
        quota=ChatQuotaState(...),
        citations=citations,
    )
    ...
```

Helper para citation excerpt:

```python
def _to_citations(chunks: Sequence[ChatRagChunk]) -> list[ChatCitation]:
    return [
        ChatCitation(
            n=index,
            chunk_id=chunk.chunk_id,
            source_type=chunk.source_type,
            source_ref=chunk.source_ref,
            ordinal=chunk.ordinal,
            score=chunk.score,
            excerpt=chunk.content[:200],
        )
        for index, chunk in enumerate(chunks, start=1)
    ]
```

### 5. Endpoint `app/api/chat.py`

Adicionar dep `provider: EmbeddingProvider = Depends(get_embedding_provider)` e passar
para `run_chat`. Sem outra mudança.

### 6. Tests

`services/ai/tests/rag/test_chat_retrieval.py` (novo):

- `test_retrieve_for_chat_happy_path`: monkeypatch `embedder.embed_texts` e
  `repository.search_similar_chunks` para devolver 3 chunks com scores 0.9, 0.6, 0.3.
  Threshold 0.5 corta o 0.3 ⇒ retorna 2.
- `test_retrieve_for_chat_budget_corta_excedente`: chunks grandes; verifica que
  `max_chars` corta antes do top_k.
- `test_retrieve_for_chat_query_vazia_retorna_vazio`.
- `test_retrieve_for_chat_embed_falha_loga_warning_e_retorna_vazio`: `embed_texts` raise →
  `[]`, sem propagação.
- `test_retrieve_for_chat_search_falha_loga_warning_e_retorna_vazio`: `search_similar_chunks`
  raise → `[]`.
- `test_retrieve_for_chat_sem_resultados_retorna_vazio`.

`services/ai/tests/orchestrator/test_rag_block.py` (novo):

- `test_build_rag_context_block_lista_numerada`: 3 chunks → string com `[1]`, `[2]`, `[3]`
  e cabeçalho `CONTEXTO RECUPERADO`.
- `test_build_rag_context_block_vazio_retorna_string_vazia`.

`services/ai/tests/orchestrator/test_chat.py` (append):

- `test_chat_inclui_rag_context_no_prompt`: monkeypatch `retrieve_for_chat` retornando 2
  chunks. Monkeypatch `generate` para capturar o `prompt` recebido. Asserta que
  `CONTEXTO RECUPERADO` aparece no prompt + content de cada chunk.
- `test_chat_sem_chunks_nao_inclui_bloco_rag`: `retrieve_for_chat` retorna `[]`.
  Prompt não contém `CONTEXTO RECUPERADO`.
- `test_chat_result_inclui_citations`: 2 chunks → `result.citations` tem 2 entradas,
  n=1 e n=2, com excerpt[:200] preservado.
- `test_chat_rag_falha_nao_quebra_chat`: monkeypatch `retrieve_for_chat` para levantar →
  `run_chat` ainda completa sem `citations` e sem bloco RAG no prompt. Nota: o catch
  já está em `retrieve_for_chat`; este teste valida que a defesa funciona se alguém
  trocar a impl no futuro. Pode skipar se a função é considerada infalível por contrato.

`services/ai/tests/prompts/test_chat.py` (append):

- `test_build_chat_prompt_rag_block_default_vazio_nao_aparece`.
- `test_build_chat_prompt_inclui_rag_block_quando_passado`.

`services/ai/tests/api/test_chat_endpoint.py` (se existir; senão skipar este step):

- Smoke do endpoint usando provider mock para garantir wiring.

### 7. README

Em `services/ai/README.md`, na seção de chat (se houver) ou abaixo de "RAG retrieval":

```markdown
## Chat com RAG

`run_chat` faz uma busca top-5 antes de chamar o Gemini. Chunks com score >= 0.5 são
injetados em `CONTEXTO RECUPERADO (cite com [N]...)` no prompt e devolvidos como
`citations` no `ChatResult`. Budget de 6000 chars no contexto. Falha de retrieval
(embed ou DB) é silenciada para warning — o chat continua sem RAG. Threshold, top_k,
char budget são constantes em `app/rag/chat_retrieval.py` (Phase 4 MVP).
```

## Closed decisions

- Hook só em `run_chat`. Actions e generate ficam fora.
- Sempre tenta retrieve. Sem flag de habilitação. Falha não quebra chat.
- Threshold default 0.5, top_k 5, char budget 6000 — constantes em `chat_retrieval.py`.
- Provider injetado como param de `run_chat`, igual `pool`/`redis_client`.
- Citações vão como campo novo `citations: list[ChatCitation]` no `ChatResult`. Default `[]`
  mantém backward compat.
- Chama `repository.search_similar_chunks` direto, não o HTTP endpoint `/v1/retrieve`.
- Bloco RAG inserido entre `references_block` e `conversation_block`.
- Excerpt na citação: primeiros 200 chars do chunk.

## Do not do

- Não criar nova migration.
- Não modificar `app/api/retrieve.py` (endpoint HTTP já cobre uso direto via BFF).
- Não modificar `actions.py` ou orchestrator de generate (escopo MVP).
- Não adicionar flag de feature para ativar/desativar RAG no chat.
- Não levantar exceção em falha de retrieval. Log + lista vazia.
- Não filtrar `source_types` no hook do chat. Mistura PDF + abstract.
- Não fazer rerank, expansion query, ou fan-out.
- Não tocar em `embedder` ou `embedding` provider.
- Não push, não abrir PR. Local commit only.

## Definition of done

Verifiable file checks:

- `test -f services/ai/app/rag/chat_retrieval.py`
- `test -f services/ai/app/orchestrator/rag_block.py`
- `grep -q 'def retrieve_for_chat' services/ai/app/rag/chat_retrieval.py`
- `grep -q 'def build_rag_context_block' services/ai/app/orchestrator/rag_block.py`
- `grep -q 'rag_context_block' services/ai/app/prompts/chat.py`
- `grep -q 'provider: EmbeddingProvider' services/ai/app/orchestrator/chat.py`
- `grep -q 'citations:' services/ai/app/orchestrator/chat.py`
- `grep -q 'class ChatCitation' services/ai/app/orchestrator/chat.py`
- `grep -q 'CONTEXTO RECUPERADO' services/ai/app/orchestrator/rag_block.py`
- `grep -q 'Chat com RAG' services/ai/README.md`

Behavioral checks (cobertos por testes):

- `retrieve_for_chat`: score threshold filtra, char budget corta, falhas → `[]`.
- `build_rag_context_block`: enumera com `[N]`, vazio quando sem chunks.
- `build_chat_prompt`: rag_block_block default não muda saída atual.
- `run_chat`: passes provider; prompt inclui `CONTEXTO RECUPERADO` se há chunks;
  `result.citations` populado; falha de RAG não propaga.

## Gates

`apps/web` não tocado. Skip.

`services/ai`:

```bash
cd services/ai
uv sync --extra dev
uv run ruff check .
uv run mypy app tests
uv run pytest -q
```

Expected: 137 prior tests passed (T-G5) continuam verdes. +9 a +12 novos. Total
esperado ~146-149 passed. Sem regressão. Skip count inalterado (testes RAG novos
não dependem de Postgres real).

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg6-chat-rag-hook
```

Single commit:

```
feat(rag): hook retrieve no chat orchestrator com citacoes (T-G6)

run_chat agora chama retrieve_for_chat em paralelo com refs e
recent messages. Chunks top-5 com score >= 0.5 e budget de 6000
chars sao injetados em CONTEXTO RECUPERADO (cite com [N]...) no
prompt entre references_block e conversation_block.

ChatResult ganha citations: list[ChatCitation] (n, chunk_id,
source_type, source_ref, ordinal, score, excerpt[:200]).

Provider passa como param keyword em run_chat (igual pool e
redis_client) e e injetado via Depends no endpoint chat.

Falha de retrieval (embed ou DB) loga warning e devolve lista
vazia. Chat segue sem RAG, sem regressao funcional.

build_chat_prompt ganha parametro opcional rag_context_block=""
mantendo backward compat.

Escopo MVP: so chat. Actions e generate ficam fora.

Implementa ADR-0002 e ADR-0008.
```

Não push, não abrir PR.

## Expected return summary

Reportar:

1. Branch + commit SHA.
2. Arquivos modificados/criados com line counts.
3. Output dos 4 gates.
4. Delta de testes (137 → ?).
5. Sample structlog `chat_rag_retrieved` em teste mockado.
6. Sample dump do `ChatResult.citations` com 2 entradas.
7. Quaisquer desvios com justificativa.
```
