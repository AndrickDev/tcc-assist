# AGENTS.md — tcc-assist-ai (serviço FastAPI)

> Skill de contexto operacional pro Codex CLI atuar **neste repo**.
> Carregado em toda sessão. Curto e atual.
> Última atualização: 2026-05-01

---

## 1. O que é este repo

Serviço FastAPI da camada de **IA / RAG** do produto Teseo (TCC-Assist).
Não é o produto inteiro — é o backend de IA. O Next.js (repo `tcc-assist`)
chama este serviço via HTTP autenticado.

**Doutrina arquitetural** mora em `../tcc-assist/docs/adr/`. Decisões fixadas:

- **ADR-0001** — IA roda separada em FastAPI (este repo).
- **ADR-0002** — Vector store é pgvector no Postgres do produto.
- **ADR-0003** — LLM gerador é Gemini Flash via API. Local só p/ embeddings.
- **ADR-0005** — Quota e rate limit em Redis, neste serviço.
- **ADR-0006** — Comunicação Next ↔ FastAPI por JWT HS256 com `INTERNAL_JWT_SECRET`.

Se algum ADR ainda não tem arquivo escrito, **pare e peça**.
**Não invente** decisão arquitetural — ADR é responsabilidade humana.

---

## 2. Stack

- Python 3.11+ (pinado em `.python-version`).
- FastAPI + Pydantic v2 + Uvicorn.
- `uv` para dependency management e execução.
- `structlog` para logging.
- Postgres (lê do produto, schema RAG via Alembic — futuro).
- Redis (quota e rate limit — futuro).
- Gemini API (provider de geração — futuro).

---

## 3. Repo map

```
app/
├── main.py                ← factory create_app() + configure_logging()
├── api/                   ← rotas HTTP (1 arquivo por feature)
│   └── health.py
├── orchestrator/          ← workflows multi-step (chat, generate, action)
├── rag/                   ← chunker, retriever, reranker, ingestion
├── providers/             ← gemini, embeddings, openalex client
├── prompts/               ← templates versionados (Python, NÃO .md)
├── quota/                 ← Redis-backed quota e rate limit
└── observability/         ← logging, tracing, metrics
    └── logging.py
tests/                     ← mirror de app/, pytest
pyproject.toml             ← deps + ruff + mypy + pytest config
Dockerfile                 ← imagem de runtime
.github/workflows/ci.yml   ← ruff + mypy + pytest no PR
.env.example               ← contrato de variáveis (sem segredo real)
```

---

## 4. Regras duras (não negociáveis)

### Tipos
- **`mypy` strict deve passar com 0 erros.** Sem exceção.
- **Sem `Any`** salvo em interface com lib externa sem stub. Justifique em comentário de 1 linha.
- **Sem `# type: ignore` sem justificativa** (mesmo padrão).
- Toda função pública tem assinatura completa (parâmetros + retorno).
- Pydantic v2: prefira `BaseModel` com `ConfigDict(frozen=True)` para DTOs imutáveis.

### Estilo
- `ruff check .` deve passar com 0 erros.
- Imports ordenados (`I` rule).
- Linhas até 100 chars.
- Sem `print` — use `structlog.get_logger()`.
- Sem `datetime.utcnow()` (deprecated) — use `datetime.now(UTC)`.

### Segurança
- **Nunca** logar `INTERNAL_JWT_SECRET`, `GOOGLE_API_KEY`, `POSTGRES_URL`, `REDIS_URL`.
- **Nunca** retornar `traceback` em response — apenas `error_code` + mensagem PT-BR.
- Endpoints (exceto `/v1/health`) exigem JWT válido — quando ADR-0006 for implementada.
- Validação de input via Pydantic. **Nunca** `dict[str, Any]` em body.

### Banco / Schema
- Convivência com Prisma (no repo `tcc-assist`): **Prisma é dono do schema "produto"** (User, Tcc, Message, Reference, Attachment).
- **Alembic neste repo é dono do schema "RAG"** (chunks, embeddings, ingestion_jobs, processed_stripe_events).
- Sem sobreposição. Mudou tabela em um lado? Anota em `docs/db-contract.md` (criar se não existir).

### Escopo
- Faça apenas o pedido. Sem refator lateral.
- Bug fora de escopo → `../tcc-assist/docs/BACKLOG.md`.
- Arquivo passou de 400 linhas? Sinal de quebrar — mas só dentro do escopo da tarefa.

---

## 5. Workflow padrão de execução

1. **Antes de codar** (≤5 linhas em PT-BR):
   - Entendimento da tarefa.
   - Arquivos a tocar.
   - Suposições. Se houver dúvida grande, **pergunta antes**.
2. **Codifica a mudança mínima.** Sem feature creep.
3. **Roda os gates localmente:**
   ```bash
   uv run ruff check .
   uv run mypy .
   uv run pytest -q
   ```
   **Todos verdes** antes de declarar pronto.
4. **Atualiza docs** se mudou contrato (rota, schema, env var).
5. **Output final** lista:
   - Arquivos criados/modificados (1 linha cada).
   - Comando pra testar localmente.
   - Riscos / o que **não** foi feito.

---

## 6. Convenções específicas

### FastAPI
- Toda rota retorna `response_model=...` Pydantic. Sem `dict` solto.
- Erros via `HTTPException` ou exception handler global.
- Nada de lógica pesada em `app/api/*` — orquestração mora em `app/orchestrator/`.

### Logging
```python
import structlog
log = structlog.get_logger(__name__)
log.info("event_name", user_id=user_id, latency_ms=42)
```
- Nome de evento `snake_case`. Campos estruturados, nunca f-strings com PII.
- Toda chamada externa (Gemini, OpenAlex, Redis) loga `latency_ms` + `status`.

### Testes
- Mirror da estrutura de `app/`. `tests/api/test_health.py` testa `app/api/health.py`.
- `TestClient(create_app())` pra rota síncrona.
- HTTP externo: mocka com `respx` (adicionar quando precisar).
- Cada teste é determinístico — sem `time.sleep`, sem dependência de internet.

### Commits
- Formato: `<tipo>(<escopo>): <descrição>` em PT-BR. Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- Escopo: nome do diretório (`api`, `quota`, `rag`, `providers`).
- Ex: `feat(quota): adiciona consume() em Redis (BL-NNN)`.

---

## 7. Onde buscar mais contexto

| Quando precisa de... | Lê |
|---|---|
| Decisão arquitetural | `../tcc-assist/docs/adr/000X-*.md` |
| Regras do repo Next | `../tcc-assist/AGENTS.md` |
| Modelo de dados produto | `../tcc-assist/prisma/schema.prisma` |
| O que falta fazer | `../tcc-assist/docs/BACKLOG.md` |
| Contrato HTTP entre serviços | `docs/api-contract.md` (criar conforme evolui) |

**Nunca leia o repo todo.** Vá direto ao arquivo do escopo.

---

## 8. Comunicação com o humano

- **Idioma:** PT-BR. Termos técnicos em inglês ok.
- **Ambiguidade:** pergunta antes de codar.
- **Output curto.** Diff mostra o quê — comente só o porquê.
- **Sem emoji** em código, commits ou docs (exceto se o humano pedir).

---

## 9. Sinais de que esta skill está desatualizada

Atualize na mesma tarefa que descobriu o gap:

- ADR foi escrito → atualiza §1 (lista de ADRs fixadas).
- Nova dependência grande adicionada (Gemini SDK, pgvector driver, Redis client) → atualiza §2.
- Novo módulo em `app/` → atualiza §3 repo map.
- Convenção nova firmada (ex: padrão de async, padrão de migration) → adiciona em §6.
