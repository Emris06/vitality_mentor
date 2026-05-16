"""POST /sim/hint -- step-by-step AI coach for the Bank Operations Simulator.

Contract (mirrors packages/shared/src/types/simulator.ts):
  Request:  AiHintRequest { runId, stepId, locale, context }
  Response: AiHintResponse { hint, rationale, citations[] }

Failure policy: this endpoint MUST NOT 5xx. The simulator UI calls it at every
step and we don't want a missing hint to break the run. On any internal
failure we log the exception and return 200 with a localized fallback hint
and empty rationale/citations.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.sim.hint import HintRequest, HintResponse, generate_hint

router = APIRouter()
log = logging.getLogger(__name__)


# Localized fallback strings, used when retrieval or generation fails so the
# UI always has something to render. Keep these short -- the user can still
# click through to the document drawer.
_FALLBACK_HINT = {
    "uz": (
        "Hozircha maslahat bera olmayman -- hujjatlarga to'g'ridan-to'g'ri "
        "murojaat qiling."
    ),
    "ru": (
        "Сейчас не могу дать подсказку -- посмотрите документы напрямую."
    ),
    "en": (
        "I can't give a hint right now -- try the documents directly."
    ),
}


def _fallback(locale: str) -> HintResponse:
    return HintResponse(
        hint=_FALLBACK_HINT.get(locale, _FALLBACK_HINT["en"]),
        rationale="",
        citations=[],
    )


@router.post("/sim/hint", response_model=HintResponse)
async def sim_hint(req: HintRequest) -> HintResponse:
    try:
        return await generate_hint(req)
    except Exception:
        # Never bubble a 500 to the simulator UI -- the run must keep going.
        log.exception(
            "sim_hint failed for runId=%s stepId=%s locale=%s",
            req.runId,
            req.stepId,
            req.locale,
        )
        return _fallback(req.locale)
