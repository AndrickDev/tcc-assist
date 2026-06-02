from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
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
