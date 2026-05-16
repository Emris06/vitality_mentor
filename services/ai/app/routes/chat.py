"""POST /chat -- SSE streaming RAG endpoint.

Event order on success:
  meta      { cache_hit, language_detected, retrieved_count }
  citation  (one event per retrieved chunk; payload matches the TS `Citation`)
  token     (text deltas from the LLM)
  done      { total_ms }

On error a single `error` event is emitted, then the stream closes.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.rag.cache import get_cached, make_key, set_cached
from app.rag.generator import stream as llm_stream
from app.rag.prompts import build_user_prompt, system_prompt
from app.rag.retriever import Chunk, retrieve

router = APIRouter()


Locale = Literal["uz", "ru", "en"]


class ChatRequest(BaseModel):
    sessionId: str = Field(..., min_length=1)
    locale: Locale | None = None
    message: str = Field(..., min_length=1)


_CYRILLIC = re.compile(r"[А-Яа-яЁё]")
_UZ_HINT = re.compile(r"\b\w*['`]\w+\b")  # words with apostrophes (o', g')


def _detect_lang(text: str) -> Locale:
    if _CYRILLIC.search(text):
        return "ru"
    if _UZ_HINT.search(text):
        return "uz"
    return "en"


def _sse(event_type: str, data) -> str:
    """Render one SSE event per the project's streaming contract.

    Frontend expects strict `data: <json>\\n\\n`.
    """
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return f"data: {payload}\n\n"


def _citation_payload(ch: Chunk) -> dict:
    """Match the shared TS `Citation` type."""
    out: dict = {
        "chunkId": ch.chunk_id,
        "sourceDoc": ch.document_title,
        "snippet": ch.snippet,
        "lang": ch.lang,
    }
    if ch.page is not None:
        out["page"] = ch.page
    return out


async def _produce_events(req: ChatRequest) -> AsyncIterator[str]:
    started = time.perf_counter()

    lang: Locale = req.locale if req.locale in ("uz", "ru", "en") else _detect_lang(req.message)
    cache_key = make_key(lang, req.message)
    cached = await get_cached(cache_key)

    # Retrieval is needed in both branches: on cache hit we still emit citation
    # events so the UI can render the source list consistently with the answer.
    try:
        chunks = await retrieve(req.message, lang=lang)
    except Exception as exc:  # pragma: no cover - defensive
        yield _sse("error", {"message": f"retrieval failed: {exc!s}"})
        return

    yield _sse(
        "meta",
        {
            "cache_hit": cached is not None,
            "language_detected": lang,
            "retrieved_count": len(chunks),
        },
    )

    for ch in chunks:
        yield _sse("citation", _citation_payload(ch))

    if cached is not None:
        # Replay cached answer as a single token event for simplicity.
        yield _sse("token", cached)
        total_ms = int((time.perf_counter() - started) * 1000)
        yield _sse("done", {"total_ms": total_ms, "cache_hit": True})
        return

    messages = [
        {"role": "system", "content": system_prompt(lang)},
        {"role": "user", "content": build_user_prompt(req.message, chunks)},
    ]

    collected: list[str] = []
    try:
        async for token in llm_stream(messages):
            collected.append(token)
            yield _sse("token", token)
    except NotImplementedError as exc:
        yield _sse("error", {"message": str(exc)})
        return
    except Exception as exc:
        yield _sse("error", {"message": f"generation failed: {exc!s}"})
        return

    final = "".join(collected).strip()
    if final:
        # Fire-and-forget cache write so we don't block `done`.
        asyncio.create_task(set_cached(cache_key, final))

    total_ms = int((time.perf_counter() - started) * 1000)
    yield _sse("done", {"total_ms": total_ms, "cache_hit": False})


@router.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    settings = get_settings()
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Latency-Budget-Ms": str(settings.chat_latency_budget_ms),
    }
    return StreamingResponse(
        _produce_events(req),
        media_type="text/event-stream",
        headers=headers,
    )
