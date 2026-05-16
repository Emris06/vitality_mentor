"""POST /skills/recommend and POST /skills/forecast.

Both endpoints follow the same failure policy as /sim/hint: they MUST NOT
5xx to the API layer. On any internal exception we log and return an empty
payload at 200, letting the API caller fall back gracefully (e.g. show
"no recommendations available" instead of a broken page).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.skills.forecast import (
    ForecastRequest,
    ForecastResponse,
    forecast as run_forecast,
)
from app.skills.recommend import (
    RecommendRequest,
    RecommendResponse,
    recommend as run_recommend,
)

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("/skills/recommend", response_model=RecommendResponse)
async def skills_recommend(req: RecommendRequest) -> RecommendResponse:
    try:
        return await run_recommend(req)
    except Exception:
        log.exception(
            "skills_recommend failed for employee_id=%s locale=%s "
            "gaps=%d modules=%d",
            req.employee_id,
            req.locale,
            len(req.gaps),
            len(req.modules),
        )
        # Empty list -- the API layer treats this as "no recommendations"
        # and renders a neutral state in the HR dashboard.
        return RecommendResponse(recommendations=[])


@router.post("/skills/forecast", response_model=ForecastResponse)
async def skills_forecast(req: ForecastRequest) -> ForecastResponse:
    try:
        return await run_forecast(req)
    except Exception:
        log.exception(
            "skills_forecast failed for employee_id=%s skill_id=%s "
            "history_len=%d horizon_days=%d",
            req.employee_id,
            req.skill_id,
            len(req.history),
            req.horizon_days,
        )
        return ForecastResponse(
            skill_id=req.skill_id,
            horizon_days=req.horizon_days,
            points=[],
        )
