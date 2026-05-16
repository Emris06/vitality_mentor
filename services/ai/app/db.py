"""Async psycopg3 connection pool, lazily created.

The pool is opened on first use (or wired into the FastAPI lifespan) and closed
on shutdown. Embedding model loading is intentionally NOT done here so Docker
health checks stay fast.
"""

from __future__ import annotations

import asyncio

from psycopg_pool import AsyncConnectionPool

from app.config import get_settings

_pool: AsyncConnectionPool | None = None
_pool_lock: asyncio.Lock = asyncio.Lock()


def _normalize_dsn(url: str) -> str:
    # psycopg3 prefers postgresql:// over postgres://.
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


async def get_pool() -> AsyncConnectionPool:
    """Return the process-wide async pool, creating it on first call."""
    global _pool
    if _pool is not None:
        return _pool
    async with _pool_lock:
        if _pool is not None:
            return _pool
        settings = get_settings()
        dsn = _normalize_dsn(settings.database_url)
        pool = AsyncConnectionPool(
            conninfo=dsn,
            min_size=1,
            max_size=10,
            kwargs={"autocommit": False},
            open=False,
        )
        await pool.open()
        _pool = pool
        return _pool


async def close_pool() -> None:
    """Close the pool on shutdown. Idempotent."""
    global _pool
    if _pool is None:
        return
    pool = _pool
    _pool = None
    await pool.close()
