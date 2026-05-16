"""Training-module recommender for the Skills Analysis Platform.

Given a list of measured skill gaps for an employee and a candidate pool of
training modules, return the top-5 modules most likely to close the gap.

Scoring blends two signals:

  baseline (deterministic, no LLM) =
      gap_size_norm * severity_weight

      gap_size_norm  = clamp((target_xp - current_xp) / max(target_xp, 1), 0, 1)
      severity_weight = {low: 0.4, medium: 0.7, high: 1.0}

  llm (qualitative ranking) =
      a 0..1 score the LLM emits per module, plus a one-sentence localized
      reason in the user's locale ("uz" / "ru" / "en").

  final = clamp(baseline * 0.6 + llm * 0.4, 0, 1)

If the LLM call times out (4s budget) or its JSON cannot be parsed, we fall
back to baseline-only scores plus a generic localized reason ("Closes a
measurable gap in <skill>."). This endpoint is allowed to degrade -- the API
caller treats an empty `recommendations` list as a graceful no-op.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Literal

from pydantic import BaseModel, Field

from app.rag.generator import stream as llm_stream
from app.rag.prompts import build_recommend_prompt

log = logging.getLogger(__name__)

Locale = Literal["uz", "ru", "en"]
Severity = Literal["low", "medium", "high"]


# ---------------------------------------------------------------------------
# Pydantic models -- mirror the TS contract called by services/api.
# ---------------------------------------------------------------------------


class GapInput(BaseModel):
    skill_id: str = Field(..., min_length=1)
    current_xp: int = Field(..., ge=0)
    target_xp: int = Field(..., ge=0)
    severity: Severity


class Module(BaseModel):
    id: str = Field(..., min_length=1)
    title: str
    skill_id: str
    estimated_minutes: int = 20


class RecommendRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    locale: Locale
    gaps: list[GapInput]
    modules: list[Module]


class Recommendation(BaseModel):
    module_id: str
    reason: str
    impact_score: float = Field(..., ge=0.0, le=1.0)


class RecommendResponse(BaseModel):
    recommendations: list[Recommendation]


# ---------------------------------------------------------------------------
# Scoring helpers.
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHT: dict[str, float] = {"low": 0.4, "medium": 0.7, "high": 1.0}

# Localized generic fallback reasons. Keep these short -- ≤ 25 words like the
# LLM is asked to do. `{skill}` is interpolated with `gap.skill_id`.
_FALLBACK_REASON: dict[str, str] = {
    "uz": "{skill} bo'yicha o'lchanadigan bilim bo'shlig'ini yopadi.",
    "ru": "Закрывает измеримый пробел в навыке {skill}.",
    "en": "Closes a measurable gap in {skill}.",
}

# Time budget for the LLM ranking call (seconds). The recommender is invoked
# from an HR dashboard, not a hot chat path -- 4s is comfortable.
_LLM_TIMEOUT_S = 4.0

# Cap how many modules we send to the LLM. Beyond ~12 the prompt gets long
# and the JSON output becomes unreliable on small local models.
_MAX_LLM_CANDIDATES = 12


def _clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x


def _baseline_score(gap: GapInput) -> float:
    """Deterministic 0..1 score for a single gap.

    Larger gaps and higher severity score higher. Capped at 1.0 so a 200%
    over-target gap doesn't dominate the blend.
    """
    denom = max(gap.target_xp, 1)
    gap_size_norm = _clamp01((gap.target_xp - gap.current_xp) / denom)
    weight = _SEVERITY_WEIGHT.get(gap.severity, 0.7)
    return _clamp01(gap_size_norm * weight)


def _fallback_reason(locale: str, skill_id: str) -> str:
    template = _FALLBACK_REASON.get(locale, _FALLBACK_REASON["en"])
    return template.format(skill=skill_id)


# ---------------------------------------------------------------------------
# LLM JSON extraction. The model is asked for a strict JSON object but small
# models occasionally wrap it in prose or ```json fences -- be defensive.
# ---------------------------------------------------------------------------

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _extract_json_object(text: str) -> dict | None:
    if not text:
        return None
    # Try fenced first.
    m = _JSON_FENCE_RE.search(text)
    if m:
        try:
            obj = json.loads(m.group(1))
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    # Fall back to first/last brace slice.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            return None
    return None


async def _llm_rank(
    locale: str,
    gaps: list[GapInput],
    candidates: list[Module],
) -> dict[str, tuple[float, str]]:
    """Ask the LLM for {module_id: (score, reason)}. Empty dict on any failure.

    Wrapped by `asyncio.wait_for` at the call site -- this helper does NOT
    enforce its own timeout. It just collects all stream tokens into a string
    and parses the resulting JSON object.
    """
    messages = build_recommend_prompt(locale, gaps, candidates)

    collected: list[str] = []
    async for token in llm_stream(messages, temperature=0.1):
        collected.append(token)
    full_text = "".join(collected).strip()

    obj = _extract_json_object(full_text)
    if not obj:
        return {}

    items = obj.get("items")
    if not isinstance(items, list):
        return {}

    out: dict[str, tuple[float, str]] = {}
    valid_ids = {m.id for m in candidates}
    for it in items:
        if not isinstance(it, dict):
            continue
        mid = it.get("module_id")
        if not isinstance(mid, str) or mid not in valid_ids:
            continue
        raw_score = it.get("score", 0.0)
        try:
            score = _clamp01(float(raw_score))
        except (TypeError, ValueError):
            score = 0.0
        reason = it.get("reason", "")
        if not isinstance(reason, str):
            reason = ""
        # Trim absurdly long reasons; the prompt asks for ≤25 words but
        # small models occasionally ramble.
        reason = reason.strip()[:280]
        out[mid] = (score, reason)
    return out


# ---------------------------------------------------------------------------
# Top-level entry point.
# ---------------------------------------------------------------------------


async def recommend(req: RecommendRequest) -> RecommendResponse:
    """Rank candidate modules against measured gaps. Returns top-5."""
    if not req.gaps or not req.modules:
        return RecommendResponse(recommendations=[])

    # Index gaps by skill_id for O(1) lookup when filtering modules and when
    # building the LLM's fallback reason.
    gap_by_skill: dict[str, GapInput] = {g.skill_id: g for g in req.gaps}

    # 1. Filter candidate modules to those that target a real measured gap.
    candidates: list[Module] = [
        m for m in req.modules if m.skill_id in gap_by_skill
    ]
    if not candidates:
        return RecommendResponse(recommendations=[])

    # 2. Deterministic baseline score per module (inherited from its gap).
    baseline: dict[str, float] = {
        m.id: _baseline_score(gap_by_skill[m.skill_id]) for m in candidates
    }

    # 3. Ask the LLM to rank a bounded slice. Order by baseline first so if
    # we have more than _MAX_LLM_CANDIDATES we send the most promising ones.
    llm_input = sorted(
        candidates, key=lambda m: baseline[m.id], reverse=True
    )[:_MAX_LLM_CANDIDATES]

    llm_scores: dict[str, tuple[float, str]] = {}
    try:
        llm_scores = await asyncio.wait_for(
            _llm_rank(req.locale, req.gaps, llm_input),
            timeout=_LLM_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        log.warning(
            "recommend: LLM ranking timed out after %.1fs -- falling back to "
            "baseline-only scores for employee_id=%s",
            _LLM_TIMEOUT_S,
            req.employee_id,
        )
    except Exception:
        # Any provider error (Ollama down, bad JSON, network blip) -- the
        # recommender must still return something useful.
        log.exception(
            "recommend: LLM ranking failed -- falling back to baseline-only "
            "for employee_id=%s",
            req.employee_id,
        )

    # 4. Blend the two signals and attach a reason (LLM if we got one, else
    # localized fallback). Modules outside `llm_input` get baseline-only.
    blended: list[Recommendation] = []
    for m in candidates:
        b = baseline[m.id]
        llm_pair = llm_scores.get(m.id)
        if llm_pair is not None:
            llm_score, llm_reason = llm_pair
            final = _clamp01(b * 0.6 + llm_score * 0.4)
            reason = (
                llm_reason
                if llm_reason
                else _fallback_reason(req.locale, m.skill_id)
            )
        else:
            # No LLM signal for this module -- treat as baseline-only. We
            # still emit a reason so the UI never shows an empty bullet.
            final = _clamp01(b)
            reason = _fallback_reason(req.locale, m.skill_id)
        blended.append(
            Recommendation(
                module_id=m.id,
                reason=reason,
                impact_score=final,
            )
        )

    # 5. Sort by impact descending, then by module id for stable tie-breaks
    # (deterministic output makes the API layer cacheable and testable).
    blended.sort(key=lambda r: (-r.impact_score, r.module_id))

    return RecommendResponse(recommendations=blended[:5])
