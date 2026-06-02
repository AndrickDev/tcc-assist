```markdown
# T-G1 Alembic bootstrap + pgvector migration

## Context

Repo: tcc-assist monorepo. Scope: `services/ai/`. Branch off `main`: `feat/tg1-alembic-pgvector`. Phase 4 (RAG) opener.

ADRs:
- ADR-0001: FastAPI owns RAG schema, Prisma owns product schema, zero overlap.
- ADR-0002: pgvector on the same Postgres as the product. Cosine distance. Embedding dim 1024 (bge-m3). IVFFlat `lists = 100`. Tables: `chunks`, `embeddings`, `ingestion_jobs`. Owned by Alembic in `services/ai/`.

## Verified state — do not re-infer

- `services/ai/app/rag/` exists, contains only `__init__.py` (`"""Retrieval-augmented generation pipeline."""`). No models, no migrations.
- No `alembic/` directory and no `alembic.ini` anywhere in `services/ai/`. Confirmed absent.
- `services/ai/app/db/config.py` exposes `get_postgres_url() -> str | None` reading env `POSTGRES_URL`. This is the single source of DB URL for the service.
- `services/ai/pyproject.toml` current deps: `asyncpg`, `fastapi`, `httpx`, `pydantic`, `pyjwt`, `redis`, `structlog`, `uvicorn[standard]`. Dev: `fakeredis`, `mypy`, `pytest`, `pytest-asyncio`, `respx`, `ruff`. No alembic, no sqlalchemy, no pgvector, no psycopg.
- `tool.mypy` is `strict = true` over `packages = ["app", "tests"]`.
- `tool.ruff` is line-length 100, target py311, lints `E F I B UP SIM`.
- `services/ai/README.md` already documents `uv sync --extra dev`, `uv run uvicorn`, and gates `ruff check . / mypy . / pytest -q`.
- Prisma schema in `apps/web/prisma/schema.prisma` owns User/Tcc/Message/Reference/Attachment. Do not import or duplicate.
- `pgcrypto` is enabled in prod DB (Prisma uses `gen_random_uuid()`); still re-assert via `CREATE EXTENSION IF NOT EXISTS pgcrypto` defensively.

## Scope

### 1. Add deps to `services/ai/pyproject.toml`

Append to `[project] dependencies`:

```toml
"alembic>=1.13",
"sqlalchemy[asyncio]>=2.0",
"pgvector>=0.3",
"psycopg[binary]>=3.2",
```

Rationale: alembic + sqlalchemy core for migration DSL. `pgvector.sqlalchemy.Vector` column type. `psycopg[binary]` is the sync driver Alembic uses for `upgrade`/`downgrade`; asyncpg stays the runtime driver and is not touched.

Add to `tool.mypy.overrides` if mypy strict complains:

```toml
[[tool.mypy.overrides]]
module = ["pgvector.*", "alembic.*"]
ignore_missing_imports = true
```

### 2. Create `services/ai/alembic.ini`

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Leave `sqlalchemy.url` empty. URL injected in `env.py`.

### 3. Create `services/ai/alembic/env.py`

```python
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.db.config import get_postgres_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _resolve_sync_url() -> str:
    raw = get_postgres_url()
    if raw is None:
        raise RuntimeError("POSTGRES_URL ausente; defina antes de rodar Alembic.")
    # Alembic uses sync driver; coerce asyncpg-style URLs to psycopg.
    if raw.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg://" + raw[len("postgresql+asyncpg://") :]
    if raw.startswith("postgres://"):
        return "postgresql+psycopg://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://") :]
    return raw


target_metadata = None  # migrations are hand-written; no autogenerate target.


def run_migrations_offline() -> None:
    url = _resolve_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = _resolve_sync_url()
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = url
    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### 4. Create `services/ai/alembic/script.py.mako`

Use Alembic default mako template (the one shipped by `alembic init`). Inline:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: str | None = ${repr(down_revision)}
branch_labels: Sequence[str] | None = ${repr(branch_labels)}
depends_on: Sequence[str] | None = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

### 5. Create `services/ai/alembic/versions/0001_rag_bootstrap.py`

```python
"""RAG bootstrap: pgvector extension + chunks/embeddings/ingestion_jobs.

Revision ID: 0001_rag_bootstrap
Revises:
Create Date: 2026-06-01

ADR-0002: cosine distance, dim 1024 (bge-m3), IVFFlat lists=100.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001_rag_bootstrap"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        "ingestion_jobs",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tcc_id", sa.Text(), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "source_type IN ('pdf', 'openalex')",
            name="ingestion_jobs_source_type_check",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'done', 'failed')",
            name="ingestion_jobs_status_check",
        ),
    )
    op.create_index(
        "ingestion_jobs_tcc_status_idx",
        "ingestion_jobs",
        ["tcc_id", "status"],
    )

    op.create_table(
        "chunks",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ingestion_job_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ingestion_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tcc_id", sa.Text(), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column(
            "metadata",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "ingestion_job_id",
            "ordinal",
            name="chunks_job_ordinal_unique",
        ),
    )
    op.create_index(
        "chunks_tcc_source_idx",
        "chunks",
        ["tcc_id", "source_type"],
    )

    op.create_table(
        "embeddings",
        sa.Column(
            "chunk_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chunks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("dim", sa.Integer(), nullable=False),
        sa.Column("vector", Vector(1024), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.execute(
        "CREATE INDEX embeddings_vector_ivfflat "
        "ON embeddings USING ivfflat (vector vector_cosine_ops) "
        "WITH (lists = 100);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS embeddings_vector_ivfflat;")
    op.drop_table("embeddings")
    op.drop_index("chunks_tcc_source_idx", table_name="chunks")
    op.drop_table("chunks")
    op.drop_index("ingestion_jobs_tcc_status_idx", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
    op.execute("DROP EXTENSION IF EXISTS vector;")
```

### 6. Append to `services/ai/README.md`

After existing "Gates locais" block, add:

```markdown
## Migrations (RAG schema)

Alembic owns the RAG tables (`chunks`, `embeddings`, `ingestion_jobs`). Prisma owns the product schema and is not touched by these migrations.

```bash
POSTGRES_URL=postgres://... uv run alembic upgrade head
POSTGRES_URL=postgres://... uv run alembic downgrade base
```

Requires `pgvector` available on the target Postgres instance. The migration enables the extension if absent.
```

### 7. CI

If `services/ai` workflow already provisions a Postgres service with pgvector, add a step:

```yaml
- name: Apply RAG migrations
  run: uv run alembic upgrade head
  env:
    POSTGRES_URL: ${{ env.POSTGRES_URL }}
```

If CI Postgres lacks pgvector, do not add the step. Note the gap in the PR description as a T-G2 prerequisite.

## Closed decisions

- pgvector on the same DB (ADR-0002), not Pinecone/Qdrant.
- Alembic owns RAG schema, Prisma owns product schema (ADR-0001).
- Cosine distance, dim 1024, IVFFlat `lists = 100` (ADR-0002).
- Tables named `chunks`, `embeddings`, `ingestion_jobs` (ADR-0002).
- Single Postgres URL: env `POSTGRES_URL`, read via `app.db.config.get_postgres_url`.
- Alembic sync driver: `psycopg[binary]`. Runtime async driver stays `asyncpg`.
- Migration file uses inline `sqlalchemy` Column DDL; no ORM models in `app/rag/` yet.

## Do not do

- Do not create SQLAlchemy ORM models or any runtime import of the new tables. T-G2/T-G3 do that.
- Do not modify `apps/web/prisma/schema.prisma` or any Prisma migration.
- Do not implement ingestion, embedding, or retrieval logic. Out of scope.
- Do not touch `services/ai/app/db/`, `app/quota/`, `app/auth/`, `app/orchestrator/`, `app/api/`, `app/providers/`, `app/prompts/`.
- Do not hardcode any DB URL. Always go through `get_postgres_url()`.
- Do not push the branch. Do not open the PR. Local commit only.

## Definition of done

Verifiable checks:

- `test -f services/ai/alembic.ini`
- `test -f services/ai/alembic/env.py`
- `test -f services/ai/alembic/script.py.mako`
- `test -f services/ai/alembic/versions/0001_rag_bootstrap.py`
- `grep -q '"alembic>=1.13"' services/ai/pyproject.toml`
- `grep -q '"pgvector>=0.3"' services/ai/pyproject.toml`
- `grep -q '"psycopg\[binary\]>=3.2"' services/ai/pyproject.toml`
- `grep -q 'CREATE EXTENSION IF NOT EXISTS vector' services/ai/alembic/versions/0001_rag_bootstrap.py`
- `grep -q 'lists = 100' services/ai/alembic/versions/0001_rag_bootstrap.py`
- `grep -q 'Vector(1024)' services/ai/alembic/versions/0001_rag_bootstrap.py`
- `grep -q 'Migrations (RAG schema)' services/ai/README.md`

Behavioral checks (run against scratch Postgres with pgvector available):

- `POSTGRES_URL=... uv run alembic upgrade head` exits 0.
- `psql $POSTGRES_URL -c '\d embeddings'` shows `vector(1024)` column and `embeddings_vector_ivfflat` index.
- `psql $POSTGRES_URL -c '\d chunks'` shows JSONB `metadata`, FK to `ingestion_jobs`, unique `(ingestion_job_id, ordinal)`.
- `POSTGRES_URL=... uv run alembic downgrade base` exits 0 and drops all three tables and the `vector` extension.

## Gates

`apps/web` not touched in this task. Skip:

```bash
# not required for T-G1 (no apps/web changes)
```

`services/ai` (must all pass before commit):

```bash
cd services/ai
uv sync --extra dev
uv run ruff check .
uv run mypy app
uv run pytest -q
```

Expected: 81 passed, 14 skipped (no new tests in this task). Any regression is a blocker.

## Branch + commit

Branch from `main`:

```bash
git checkout main
git pull
git checkout -b feat/tg1-alembic-pgvector
```

Single commit:

```
feat(ai): bootstrap Alembic + pgvector RAG schema (T-G1)

Inicializa Alembic em services/ai/ e adiciona migration 0001 que
cria a extensao pgvector, as tabelas chunks/embeddings/ingestion_jobs
e o indice IVFFlat (lists=100, cosine) per ADR-0002.

Sem runtime code: migration-only. Prisma continua dono do schema
de produto. Phase 4 (RAG) opener.
```

Do not push. Do not open PR.

## Expected return summary

Report back:

1. Branch name and commit SHA.
2. List of files created/modified with line counts.
3. Output of all four gate commands (`uv sync`, `ruff check`, `mypy`, `pytest -q`).
4. Output of `alembic upgrade head` and `alembic downgrade base` against a scratch DB, or an explicit note that no test DB with pgvector was available locally.
5. `psql \d embeddings` and `psql \d chunks` output if a test DB was reached.
6. Any deviation from this brief with one-line rationale.
```
