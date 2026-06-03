"""E2E smoke for Phase 4 RAG (ingestion -> retrieval -> chat with citations).

Usage (from services/ai/):

    docker-compose up -d
    # Apply Prisma migrations against the docker DB (run once):
    cd ../../apps/web && DATABASE_URL=postgresql://tcc:tcc@localhost:5432/tcc \\
        npx prisma migrate deploy && cd -
    # Apply Alembic RAG migrations (run once or after schema changes):
    POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc \\
        .venv/bin/alembic upgrade head
    # Seed minimal Prisma rows for smoke:
    psql postgresql://tcc:tcc@localhost:5432/tcc -f dev/seed_minimal.sql
    # Start FastAPI in another shell:
    .venv/bin/uvicorn app.main:app --reload
    # Run smoke:
    POSTGRES_URL=postgresql://tcc:tcc@localhost:5432/tcc \\
    REDIS_URL=redis://localhost:6379/0 \\
    INTERNAL_JWT_SECRET=$INTERNAL_JWT_SECRET \\
    GOOGLE_API_KEY=$GOOGLE_API_KEY \\
        .venv/bin/python dev/smoke_e2e.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from typing import Any

import httpx
import jwt

FASTAPI_URL = os.environ.get("FASTAPI_URL", "http://localhost:8000")
TCC_ID = "smoke-tcc-1"
USER_ID = "smoke-user-1"
PLAN = "FREE"
REFERENCE_ID = "smoke-ref-1"

ISSUER = "tcc-assist-web"
AUDIENCE = "tcc-assist-ai"


def _sign_jwt(*, scope: str, tcc_id: str | None) -> str:
    secret = os.environ["INTERNAL_JWT_SECRET"]
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": USER_ID,
        "plan": PLAN,
        "scope": scope,
        "iat": now,
        "exp": now + 120,
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    if tcc_id is not None:
        claims["tcc_id"] = tcc_id
    return jwt.encode(claims, secret, algorithm="HS256")


def _header(scope: str, tcc_id: str | None) -> dict[str, str]:
    token = _sign_jwt(scope=scope, tcc_id=tcc_id)
    return {"Authorization": f"Bearer {token}"}


def _section(title: str) -> None:
    print(f"\n=== {title} ===", flush=True)


def _pp(payload: object) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False)[:2000], flush=True)


async def _health(client: httpx.AsyncClient) -> None:
    _section("health")
    response = await client.get(f"{FASTAPI_URL}/v1/health")
    response.raise_for_status()
    _pp(response.json())


async def _ingest_reference(client: httpx.AsyncClient) -> str:
    _section("POST /v1/ingest/reference")
    response = await client.post(
        f"{FASTAPI_URL}/v1/ingest/reference",
        json={"reference_id": REFERENCE_ID},
        headers=_header("ingest", TCC_ID),
    )
    if response.status_code != 202:
        print(f"unexpected status {response.status_code}", flush=True)
        _pp(response.json())
        sys.exit(1)
    data = response.json()
    _pp(data)
    return str(data["job_id"])


async def _poll_status(client: httpx.AsyncClient, job_id: str, timeout_s: float = 30.0) -> None:
    _section("GET /v1/ingest/{job_id} polling")
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        response = await client.get(
            f"{FASTAPI_URL}/v1/ingest/{job_id}",
            headers=_header("ingest", TCC_ID),
        )
        response.raise_for_status()
        data = response.json()
        status = data["status"]
        print(f"  status={status} chunks={data['chunk_count']}", flush=True)
        if status in ("done", "failed"):
            _pp(data)
            if status == "failed":
                sys.exit(2)
            return
        await asyncio.sleep(1.0)
    print("timeout polling ingestion", flush=True)
    sys.exit(3)


async def _retrieve(client: httpx.AsyncClient) -> None:
    _section("POST /v1/retrieve (probe)")
    response = await client.post(
        f"{FASTAPI_URL}/v1/retrieve",
        json={"query": "memory T cells in viral infection", "top_k": 5},
        headers=_header("retrieve", TCC_ID),
    )
    response.raise_for_status()
    data = response.json()
    print(f"got {len(data['chunks'])} chunks, model={data['model']}", flush=True)
    for chunk in data["chunks"]:
        print(
            f"  - score={chunk['score']:.4f} "
            f"source={chunk['source_type']}#{chunk['source_ref'][:12]} "
            f"excerpt={chunk['content'][:80]!r}",
            flush=True,
        )


async def _chat(client: httpx.AsyncClient) -> None:
    _section("POST /v1/chat (with RAG hook)")
    response = await client.post(
        f"{FASTAPI_URL}/v1/chat",
        json={
            "tcc_id": TCC_ID,
            "message": "Explique como as celulas T de memoria atuam na infeccao viral.",
        },
        headers=_header("chat", TCC_ID),
    )
    if response.status_code != 200:
        print(f"unexpected status {response.status_code}", flush=True)
        _pp(response.json())
        sys.exit(4)
    data = response.json()
    print(f"agent_id={data.get('agent_id')}", flush=True)
    print(f"quota={data.get('quota')}", flush=True)
    citations = data.get("citations") or []
    print(f"\ncitations ({len(citations)}):", flush=True)
    for citation in citations:
        print(
            f"  [{citation['n']}] score={citation['score']:.4f} "
            f"source={citation['source_type']}#{citation['source_ref'][:12]} "
            f"excerpt={citation['excerpt'][:80]!r}",
            flush=True,
        )
    print(f"\ncontent preview:\n{data.get('content', '')[:600]}", flush=True)


async def main() -> None:
    for env in ("INTERNAL_JWT_SECRET", "GOOGLE_API_KEY"):
        if not os.environ.get(env):
            print(f"missing env: {env}", flush=True)
            sys.exit(1)
    async with httpx.AsyncClient(timeout=30.0) as client:
        await _health(client)
        job_id = await _ingest_reference(client)
        await _poll_status(client, job_id)
        await _retrieve(client)
        await _chat(client)
    print("\n=== smoke ok ===", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
