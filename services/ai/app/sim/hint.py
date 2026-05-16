"""Step-by-step AI hint orchestration for the Bank Operations Simulator.

The simulator UI POSTs to `/sim/hint` at each step. We must:
  1. Build a retrieval query from (scenario_id, step_id) using a curated
     multilingual hint dictionary -- falls back to a plain concat if unknown.
  2. Retrieve top-k SOP chunks in the user's locale via the same hybrid
     retriever the chatbot uses, so hints are grounded in the same source of
     truth.
  3. Generate a structured response from the LLM with two labeled sections
     (Hint / Rationale), collecting all tokens (no streaming here).
  4. Parse the labeled sections back out into the shared TS contract shape.

This module is locale-aware (uz / ru / en) end to end. The fallback strings
returned by the route on failure are also localized.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.rag.generator import stream as llm_stream
from app.rag.prompts import build_sim_hint_prompt
from app.rag.retriever import retrieve

log = logging.getLogger(__name__)

Locale = Literal["uz", "ru", "en"]


# ---------------------------------------------------------------------------
# Pydantic models -- mirror packages/shared/src/types/simulator.ts exactly.
# ---------------------------------------------------------------------------


class HintRequest(BaseModel):
    runId: str = Field(..., min_length=1)
    stepId: str = Field(..., min_length=1)
    locale: Locale
    context: dict[str, Any] = Field(default_factory=dict)


class HintResponse(BaseModel):
    hint: str
    rationale: str
    citations: list[str]


# ---------------------------------------------------------------------------
# Step-to-query map. Keys are (scenario_id, step_id). Values are multilingual
# search queries -- intentionally include uz/ru/en terms so the hybrid
# retriever can match SOPs regardless of which locale the source doc is in.
# ---------------------------------------------------------------------------

STEP_QUERY_HINTS: dict[tuple[str, str], str] = {
    ("kyc", "intake"): (
        "KYC client intake onboarding identification customer questionnaire "
        "anketa identifikatsiya klienta"
    ),
    ("kyc", "verify_documents"): (
        "KYC document verification passport income statement validity check "
        "proverka dokumentov pasport spravka o dohodah hujjatlarni tekshirish"
    ),
    ("kyc", "sanctions_check"): (
        "sanctions screening PEP politically exposed person watchlist OFAC "
        "sanksiyalar ro'yxati proverka sanktsionnogo spiska"
    ),
    ("kyc", "risk_score"): (
        "customer risk scoring rating AML high medium low risk profile "
        "otsenka riska klienta xavf darajasi"
    ),
    ("kyc", "decision"): (
        "KYC decision approve reject escalate compliance officer sign-off "
        "reshenie po klientu odobrenie otkaz qaror qabul qilish"
    ),
}


def _retrieval_query(scenario_id: str, step_id: str) -> str:
    return STEP_QUERY_HINTS.get(
        (scenario_id, step_id),
        f"{scenario_id} {step_id}",
    )


def _scenario_id_from(req: HintRequest) -> str:
    """Best-effort scenario_id extraction.

    The shared TS contract puts `scenarioId` inside `context` rather than on
    the top-level request, so we read it from there. We accept several common
    key spellings to be resilient against the API layer's serialization.
    """
    ctx = req.context or {}
    for key in ("scenarioId", "scenario_id", "scenario"):
        val = ctx.get(key)
        if isinstance(val, str) and val:
            return val
    # Sensible default -- KYC is the only scenario with curated hints today.
    return "kyc"


# ---------------------------------------------------------------------------
# Response parser. Splits the LLM output into hint / rationale by matching
# localized labels. Case-insensitive; tolerates Markdown bold and a few label
# variants. If parsing fails, the caller dumps the whole text into `hint`.
# ---------------------------------------------------------------------------

# Map locale -> (hint label regex alternatives, rationale label regex alts).
# We include English labels for every locale because the LLM sometimes echoes
# them back regardless of the requested language.
_HINT_LABELS = {
    "uz": ("maslahat|hint", "sabab|asoslash|izoh|rationale"),
    "ru": ("подсказка|совет|hint", "обоснование|объяснение|причина|rationale"),
    "en": ("hint|advice|suggestion", "rationale|reason|why|explanation"),
}


def _build_label_re(alts: str) -> re.Pattern[str]:
    # Matches: optional bold/italic, label, optional bold/italic, then ':' / '：'.
    # Anchored to start of line to avoid mid-sentence false positives.
    return re.compile(
        rf"^\s*[*_]{{0,2}}\s*(?:{alts})\s*[*_]{{0,2}}\s*[:：]\s*",
        re.IGNORECASE | re.MULTILINE,
    )


def parse_hint_response(text: str, locale: str) -> tuple[str, str]:
    """Split an LLM response into (hint, rationale) using localized labels.

    Returns ("", "") only if the input is empty/whitespace. On any partial
    match (e.g. only "Hint:" found), the unmatched section is returned as "".
    On total parse failure, the whole text is returned as the hint.
    """
    if not text or not text.strip():
        return "", ""

    hint_alts, rationale_alts = _HINT_LABELS.get(locale, _HINT_LABELS["en"])
    hint_re = _build_label_re(hint_alts)
    rationale_re = _build_label_re(rationale_alts)

    hint_match = hint_re.search(text)
    rationale_match = rationale_re.search(text)

    if hint_match is None and rationale_match is None:
        # No labels at all -- best effort: whole thing is the hint.
        return text.strip(), ""

    hint_value = ""
    rationale_value = ""

    if hint_match is not None:
        start = hint_match.end()
        end = rationale_match.start() if (
            rationale_match is not None and rationale_match.start() >= start
        ) else len(text)
        hint_value = text[start:end].strip()

    if rationale_match is not None:
        start = rationale_match.end()
        end = (
            hint_match.start()
            if (hint_match is not None and hint_match.start() >= start)
            else len(text)
        )
        rationale_value = text[start:end].strip()

    # Trim Markdown bold/italic markers and stray punctuation that the LLM
    # may emit around the label (e.g. "**Hint:** body" -> the closing "**"
    # ends up at the start of `body`).
    _STRIP_CHARS = ":*_ \t\r\n"
    hint_value = hint_value.strip(_STRIP_CHARS)
    rationale_value = rationale_value.strip(_STRIP_CHARS)

    return hint_value, rationale_value


# ---------------------------------------------------------------------------
# Top-level orchestrator.
# ---------------------------------------------------------------------------


async def generate_hint(req: HintRequest) -> HintResponse:
    """Retrieve grounding chunks and ask the LLM for a step hint."""
    scenario_id = _scenario_id_from(req)
    query = _retrieval_query(scenario_id, req.stepId)

    chunks = await retrieve(
        query,
        lang=req.locale,
        k_dense=6,
        k_lex=6,
        k_final=3,
    )

    system_prompt, user_prompt = build_sim_hint_prompt(
        locale=req.locale,
        scenario_id=scenario_id,
        step_id=req.stepId,
        context=req.context,
        retrieved_chunks=chunks,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # Non-streaming: just collect all tokens. The sim UI doesn't need SSE here.
    collected: list[str] = []
    async for token in llm_stream(messages, temperature=0.2):
        collected.append(token)
    full_text = "".join(collected).strip()

    hint, rationale = parse_hint_response(full_text, req.locale)
    citations = [ch.chunk_id for ch in chunks]

    return HintResponse(hint=hint, rationale=rationale, citations=citations)
