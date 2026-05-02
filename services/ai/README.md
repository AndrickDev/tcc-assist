# tcc-assist-ai

Servico FastAPI da camada de IA/RAG do Teseo / TCC-Assist.

## Desenvolvimento

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

Healthcheck:

```bash
curl http://localhost:8000/v1/health
```

Gates locais:

```bash
uv run ruff check .
uv run mypy .
uv run pytest -q
```

## Estrutura

```text
app/
├── api/
├── orchestrator/
├── rag/
├── providers/
├── prompts/
├── quota/
└── observability/
```

