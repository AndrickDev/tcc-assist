"""RAG bootstrap: pgvector extension + chunks/embeddings/ingestion_jobs.

Revision ID: 0001_rag_bootstrap
Revises:
Create Date: 2026-06-01

ADR-0002 (amended 2026-06-02): cosine distance, dim 768 (Google
text-embedding-004 for MVP), IVFFlat lists=100. Original ADR-0002 specified
dim 1024 (bge-m3 local); see ADR-0008 for the MVP provider decision and the
documented migration path to a higher-dim model when budget permits.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

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
        sa.Column("vector", Vector(768), nullable=False),
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
