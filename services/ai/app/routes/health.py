import time
from typing import Any

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "vitality-ai",
        "version": "0.0.0",
        "timestamp": time.time(),
        "config": {
            "embedding_model": settings.embedding_model,
            "embedding_dim": settings.embedding_dim,
            "gen_provider": settings.gen_provider,
            "latency_budget_ms": settings.chat_latency_budget_ms,
        },
    }
