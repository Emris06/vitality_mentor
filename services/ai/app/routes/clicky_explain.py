"""POST /clicky/explain — RAG-grounded spoken answer for Clicky."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.rag.generator import stream as llm_stream
from app.rag.prompts import build_user_prompt, system_prompt
from app.rag.retriever import retrieve
from app.sim.hint import STEP_QUERY_HINTS

router = APIRouter()
log = logging.getLogger(__name__)

Locale = Literal["uz", "ru", "en"]


class ClickyExplainRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=500)
    locale: Locale = "ru"
    scenarioId: str | None = None
    stepId: str | None = None


class ClickyExplainResponse(BaseModel):
    spoken: str
    citations: list[str] = Field(default_factory=list)


_FALLBACK = {
    "uz": "Hozircha aniq javob bera olmayman — hujjatlarni ko'rib chiqing.",
    "ru": "Сейчас не могу дать точный ответ — посмотрите документы.",
    "en": "I can't give a grounded answer right now — check the documents.",
}


def _retrieval_query(scenario_id: str | None, step_id: str | None, transcript: str) -> str:
    if scenario_id and step_id:
        hint = STEP_QUERY_HINTS.get((scenario_id, step_id))
        if hint:
            return f"{hint} {transcript}"
    return transcript


@router.post("/clicky/explain", response_model=ClickyExplainResponse)
async def clicky_explain(req: ClickyExplainRequest) -> ClickyExplainResponse:
    try:
        query = _retrieval_query(req.scenarioId, req.stepId, req.transcript)
        chunks = await retrieve(query, req.locale, k_final=4)
        citations = [c.document_title for c in chunks[:3]]

        sys_p = (
            system_prompt(req.locale)
            + "\n\nYou are Clicky, a voice coach. Reply with ONE or TWO short sentences "
            "the intern can hear while working. No markdown, no lists."
        )
        user_p = build_user_prompt(req.transcript, chunks)

        text_parts: list[str] = []
        async for token in llm_stream(sys_p, user_p):
            text_parts.append(token)
        spoken = "".join(text_parts).strip()
        if not spoken:
            return ClickyExplainResponse(
                spoken=_FALLBACK.get(req.locale, _FALLBACK["en"]),
                citations=[],
            )
        if len(spoken) > 280:
            spoken = spoken[:277] + "…"
        return ClickyExplainResponse(spoken=spoken, citations=citations)
    except Exception:
        log.exception("clicky_explain failed")
        return ClickyExplainResponse(
            spoken=_FALLBACK.get(req.locale, _FALLBACK["en"]),
            citations=[],
        )
