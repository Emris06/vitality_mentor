"""LLM generation providers with a unified streaming interface.

``stream(messages, temperature)`` yields text deltas as they arrive from the
backend. Ollama is fully implemented (no auth required for local dev).
OpenAI and Anthropic providers are stubs that raise NotImplementedError with
a clear TODO -- they will be wired in once the hosted API keys are issued.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.config import get_settings

# Single shared client; the FastAPI lifespan does not need to manage it
# because httpx clients can be GC'd cleanly at process exit. We do create a
# fresh client per stream call to avoid event-loop binding issues between
# tests and prod.


async def _stream_ollama(
    messages: list[dict], temperature: float
) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature},
    }
    timeout = httpx.Timeout(
        connect=5.0,
        read=60.0,
        write=10.0,
        pool=5.0,
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                # /api/chat streams: {"message": {"role":..,"content":..}, "done": bool}
                msg = obj.get("message") or {}
                token = msg.get("content")
                if token:
                    yield token
                if obj.get("done"):
                    break


async def _stream_openai(
    messages: list[dict], temperature: float
) -> AsyncIterator[str]:
    # TODO(provider-openai): wire to https://api.openai.com/v1/chat/completions
    # with SSE parsing. Stubbed until OPENAI_API_KEY is provisioned in env.
    raise NotImplementedError(
        "OpenAI provider is not implemented yet. "
        "Set GEN_PROVIDER=ollama for local dev, or implement _stream_openai."
    )
    # Make this an async generator so the type checker treats it as one.
    yield  # pragma: no cover


async def _stream_anthropic(
    messages: list[dict], temperature: float
) -> AsyncIterator[str]:
    # TODO(provider-anthropic): wire to https://api.anthropic.com/v1/messages
    # with the streaming event format. Stubbed until ANTHROPIC_API_KEY is set.
    raise NotImplementedError(
        "Anthropic provider is not implemented yet. "
        "Set GEN_PROVIDER=ollama for local dev, or implement _stream_anthropic."
    )
    yield  # pragma: no cover


async def stream(
    messages: list[dict], temperature: float = 0.2
) -> AsyncIterator[str]:
    """Yield text deltas from the configured provider."""
    provider = get_settings().gen_provider
    if provider == "ollama":
        async for tok in _stream_ollama(messages, temperature):
            yield tok
    elif provider == "openai":
        async for tok in _stream_openai(messages, temperature):
            yield tok
    elif provider == "anthropic":
        async for tok in _stream_anthropic(messages, temperature):
            yield tok
    else:
        raise ValueError(f"unknown gen_provider: {provider!r}")
