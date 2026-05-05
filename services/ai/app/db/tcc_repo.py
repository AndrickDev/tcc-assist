import asyncpg

from app.db.models import MessageRow, ReferenceRow, TccMetadata


async def get_tcc_metadata(
    *,
    pool: asyncpg.Pool,
    tcc_id: str,
    user_id: str,
) -> TccMetadata | None:
    query = """
        SELECT
            id,
            title,
            course,
            institution,
            "workType" AS work_type,
            norma,
            objective,
            "userId" AS owner_id
        FROM "Tcc"
        WHERE id = $1 AND "userId" = $2
    """
    row = await pool.fetchrow(query, tcc_id, user_id)
    if row is None:
        return None
    return TccMetadata.model_validate(dict(row))


async def list_recent_messages(
    *,
    pool: asyncpg.Pool,
    tcc_id: str,
    limit: int,
) -> list[MessageRow]:
    query = """
        SELECT id, role, content, "createdAt" AS created_at
        FROM "Message"
        WHERE "tccId" = $1
        ORDER BY "createdAt" DESC
        LIMIT $2
    """
    rows = await pool.fetch(query, tcc_id, limit)
    return [MessageRow.model_validate(dict(row)) for row in rows]


async def list_selected_references(
    *,
    pool: asyncpg.Pool,
    tcc_id: str,
) -> list[ReferenceRow]:
    query = """
        SELECT
            id,
            title,
            authors,
            year,
            source,
            "citationCount" AS citation_count,
            "createdAt" AS created_at
        FROM "Reference"
        WHERE "tccId" = $1 AND selected = true
        ORDER BY "citationCount" DESC NULLS LAST, "createdAt" DESC
    """
    rows = await pool.fetch(query, tcc_id)
    return [ReferenceRow.model_validate(dict(row)) for row in rows]
