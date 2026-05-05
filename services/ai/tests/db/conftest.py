import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import asyncpg
import pytest


@pytest.fixture(scope="session")
async def postgres_pool() -> AsyncIterator[asyncpg.Pool]:
    postgres_url = os.environ.get("TEST_POSTGRES_URL")
    if not postgres_url:
        pytest.skip("TEST_POSTGRES_URL not set")

    pool = await asyncpg.create_pool(postgres_url, min_size=1, max_size=2)
    if pool is None:
        raise RuntimeError("asyncpg.create_pool returned None")

    # Test schema mirrors only the Prisma columns queried by T-E1. Prisma remains source of truth.
    await _reset_schema(pool)
    await _seed(pool)
    try:
        yield pool
    finally:
        await _drop_schema(pool)
        await pool.close()


async def _reset_schema(pool: asyncpg.Pool) -> None:
    await _drop_schema(pool)
    await pool.execute(
        """
        CREATE TABLE "Tcc" (
            id text PRIMARY KEY,
            "userId" text NOT NULL,
            title text NOT NULL,
            course text NOT NULL,
            institution text NOT NULL,
            norma text,
            objective text,
            "workType" text
        );

        CREATE TABLE "Message" (
            id text PRIMARY KEY,
            "tccId" text NOT NULL,
            role text NOT NULL,
            content text NOT NULL,
            "createdAt" timestamptz NOT NULL
        );

        CREATE TABLE "Reference" (
            id text PRIMARY KEY,
            "tccId" text NOT NULL,
            "externalId" text NOT NULL,
            source text NOT NULL DEFAULT 'semantic-scholar',
            title text NOT NULL,
            authors text NOT NULL,
            year integer,
            "citationCount" integer,
            selected boolean NOT NULL DEFAULT false,
            "createdAt" timestamptz NOT NULL
        );
        """
    )


async def _drop_schema(pool: asyncpg.Pool) -> None:
    await pool.execute('DROP TABLE IF EXISTS "Reference", "Message", "Tcc"')


async def _seed(pool: asyncpg.Pool) -> None:
    base = datetime(2026, 5, 5, tzinfo=UTC)
    await pool.execute(
        """
        INSERT INTO "Tcc" (id, "userId", title, course, institution, norma, objective, "workType")
        VALUES
            ('tcc-1', 'user-1', 'Titulo 1', 'Computacao', 'UF Teste', 'ABNT', 'Objetivo', 'Artigo'),
            ('tcc-empty', 'user-1', 'Titulo vazio', 'Computacao', 'UF Teste', NULL, NULL, NULL)
        """
    )
    await pool.executemany(
        """
        INSERT INTO "Message" (id, "tccId", role, content, "createdAt")
        VALUES ($1, $2, $3, $4, $5)
        """,
        [
            ("msg-1", "tcc-1", "user", "primeira", base),
            ("msg-2", "tcc-1", "bot", "segunda", base + timedelta(minutes=1)),
            ("msg-3", "tcc-1", "user", "terceira", base + timedelta(minutes=2)),
        ],
    )
    await pool.executemany(
        """
        INSERT INTO "Reference" (
            id, "tccId", "externalId", source, title, authors, year,
            "citationCount", selected, "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """,
        [
            (
                "ref-1",
                "tcc-1",
                "ext-1",
                "semantic-scholar",
                "Ref baixa",
                "Ana",
                2024,
                5,
                True,
                base,
            ),
            (
                "ref-2",
                "tcc-1",
                "ext-2",
                "semantic-scholar",
                "Ref alta",
                "Bia",
                2023,
                20,
                True,
                base + timedelta(minutes=1),
            ),
            (
                "ref-3",
                "tcc-1",
                "ext-3",
                "semantic-scholar",
                "Ref nao selecionada",
                "Caio",
                2022,
                100,
                False,
                base + timedelta(minutes=2),
            ),
            (
                "ref-4",
                "tcc-1",
                "ext-4",
                "semantic-scholar",
                "Ref sem citacao",
                "Dora",
                None,
                None,
                True,
                base + timedelta(minutes=3),
            ),
        ],
    )
