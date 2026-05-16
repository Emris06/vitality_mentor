"""Redis-backed cache for full chat responses.

Keys are sha256 over ``lang:normalized_query``. Values are the full assistant
response text (the rendered final answer, citations re-issued on cache hit
by the chat route by re-running retrieval -- cheap and keeps cited [n]s
consistent with what the user sees).

Normalization: lowercase, collapse whitespace, strip trailing punctuation.
"""

from __future__ import annotations

import asyncio
import hashlib
import re

import redis.asyncio as redis_asyncio

from app.config import get_settings

_client: redis_asyncio.Redis | None = None
_client_lock: asyncio.Lock = asyncio.Lock()

_WS = re.compile(r"\s+")
_TRAILING_PUNCT = re.compile(r"[\s\.\?\!\,\;\:\)\(\[\]\"'`]+$")


async def _get_client() -> redis_asyncio.Redis:
    global _client
    if _client is not None:
        return _client
    async with _client_lock:
        if _client is not None:
            return _client
        settings = get_settings()
        _client = redis_asyncio.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        return _client


def _normalize(text: str) -> str:
    text = (text or "").lower().strip()
    text = _WS.sub(" ", text)
    text = _TRAILING_PUNCT.sub("", text)
    return text


def make_key(lang: str, query: str) -> str:
    payload = f"{lang}:{_normalize(query)}".encode()
    digest = hashlib.sha256(payload).hexdigest()
    return f"chat:v1:{digest}"


async def get_cached(key: str) -> str | None:
    try:
        client = await _get_client()
        return await client.get(key)
    except Exception:
        # Cache failures must never break the chat path.
        return None


async def set_cached(key: str, value: str, ttl_seconds: int = 3600) -> None:
    try:
        client = await _get_client()
        await client.set(key, value, ex=ttl_seconds)
    except Exception:
        # Swallow cache write errors; the answer was already produced.
        return None


async def close_cache() -> None:
    global _client
    if _client is None:
        return
    client = _client
    _client = None
    try:
        await client.aclose()
    except Exception:
        pass
