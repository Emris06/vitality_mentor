"""90-day skill-XP trajectory forecast.

Pure numpy. No LLM, no DB. The API layer hands us a per-day history of
cumulative XP for a single (employee, skill) pair and we project the next
`horizon_days` days using ordinary least-squares on the most recent window.

Confidence band is `expected ± 1.96 * residual_std`, i.e. a 95% Gaussian
interval around the linear fit. This is intentionally simple -- the HR UI
shows a shaded band, not a probability distribution -- and we clamp the
lower bound at zero because negative XP is meaningless.

To keep response payloads small we sample at every 7th day plus the first
and last forecast day. That gives ~14 points for a 90-day horizon.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

import numpy as np
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic models -- TS contract on the API side.
# ---------------------------------------------------------------------------


class HistoryPoint(BaseModel):
    date: str  # ISO YYYY-MM-DD
    xp: int = Field(..., ge=0)


class ForecastRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    skill_id: str = Field(..., min_length=1)
    history: list[HistoryPoint]
    horizon_days: int = Field(default=90, ge=1, le=365)


class ForecastPoint(BaseModel):
    date: str  # ISO YYYY-MM-DD
    expected: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    skill_id: str
    horizon_days: int
    points: list[ForecastPoint]


# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------

# Window of history actually used for the OLS fit. Newer slope is more
# representative of current learning velocity than ancient on-boarding data.
_FIT_WINDOW_DAYS = 30

# 95% Gaussian interval. Hard-coded -- the HR PRD only asks for one band.
_Z = 1.96


def _parse_iso(s: str) -> date | None:
    try:
        return datetime.fromisoformat(s).date()
    except (TypeError, ValueError):
        return None


def _densify(history: list[HistoryPoint]) -> tuple[list[date], np.ndarray]:
    """Forward-fill the per-day cumulative-XP series.

    Returns (dates, xp_array). Both have the same length, one entry per day
    from min(date) to max(date) inclusive. Days with no recorded XP inherit
    the previous day's value (cumulative XP cannot go down).

    Skips malformed rows silently -- the API layer is expected to validate
    upstream, but a single bad ISO date should not nuke the whole forecast.
    """
    parsed: list[tuple[date, int]] = []
    for h in history:
        d = _parse_iso(h.date)
        if d is None:
            continue
        parsed.append((d, int(h.xp)))
    if not parsed:
        return [], np.zeros(0, dtype=np.float64)

    # Multiple entries on the same day: keep the max (cumulative).
    by_day: dict[date, int] = {}
    for d, xp in parsed:
        prev = by_day.get(d)
        if prev is None or xp > prev:
            by_day[d] = xp

    start = min(by_day.keys())
    end = max(by_day.keys())
    span_days = (end - start).days + 1

    dates: list[date] = [start + timedelta(days=i) for i in range(span_days)]
    series = np.zeros(span_days, dtype=np.float64)
    last_val = 0.0
    for i, d in enumerate(dates):
        if d in by_day:
            last_val = float(by_day[d])
        series[i] = last_val
    return dates, series


def _fit_ols(
    series: np.ndarray,
) -> tuple[float, float, float]:
    """Fit y = m*x + b on the last _FIT_WINDOW_DAYS samples.

    Returns (slope, intercept, residual_std). The intercept is in the same
    coordinate frame as the slice (x=0 is the first day of the slice).
    """
    n = series.shape[0]
    if n < 2:
        # Degenerate: a single observation has no slope and no residual.
        const = float(series[0]) if n == 1 else 0.0
        return 0.0, const, 0.0

    window = series[-_FIT_WINDOW_DAYS:] if n > _FIT_WINDOW_DAYS else series
    x = np.arange(window.shape[0], dtype=np.float64)
    # np.polyfit returns highest-power coefficient first.
    m, b = np.polyfit(x, window, 1)
    residuals = window - (m * x + b)
    # ddof=1 gives the unbiased estimator; clamp at 0 for length-2 windows
    # where ddof=1 with 2 samples is still defined but very noisy.
    s = float(np.std(residuals, ddof=1)) if window.shape[0] > 2 else 0.0
    return float(m), float(b), s


def _sample_indices(horizon_days: int) -> list[int]:
    """Indices into the forecast horizon to actually emit.

    Always emits day 0 (first forecast day) and day horizon_days-1 (last),
    plus every 7th day in between. Sorted, deduplicated.
    """
    if horizon_days <= 0:
        return []
    if horizon_days == 1:
        return [0]
    idxs = set(range(0, horizon_days, 7))
    idxs.add(0)
    idxs.add(horizon_days - 1)
    return sorted(idxs)


# ---------------------------------------------------------------------------
# Top-level entry point.
# ---------------------------------------------------------------------------


async def forecast(req: ForecastRequest) -> ForecastResponse:
    """Project cumulative skill XP `horizon_days` into the future."""
    dates, series = _densify(req.history)
    if series.shape[0] == 0:
        # No usable history -- the API layer should fall back to "no forecast
        # available" in the UI. Return an empty point list, not an error.
        return ForecastResponse(
            skill_id=req.skill_id,
            horizon_days=req.horizon_days,
            points=[],
        )

    m, b, s = _fit_ols(series)

    # The OLS intercept is in the coordinate frame of the fit window. Map
    # day-after-history to the next x-index after the window.
    if series.shape[0] >= _FIT_WINDOW_DAYS:
        window_len = _FIT_WINDOW_DAYS
    else:
        window_len = series.shape[0]
    # First forecast day corresponds to x = window_len (one past the last
    # sample in the fit window).
    base_x = float(window_len)
    last_history_date = dates[-1]

    sampled = _sample_indices(req.horizon_days)
    points: list[ForecastPoint] = []
    for day_offset in sampled:
        x = base_x + day_offset
        expected = m * x + b
        lower = expected - _Z * s
        upper = expected + _Z * s
        # Cumulative XP can't go below zero; cap the band at zero on the
        # downside. We do NOT cap the expected itself -- a negative expected
        # signals a regressing learner and the API can surface that as a
        # warning if it wants.
        lower = max(lower, 0.0)
        if upper < 0.0:
            upper = 0.0
        forecast_date = last_history_date + timedelta(days=day_offset + 1)
        points.append(
            ForecastPoint(
                date=forecast_date.isoformat(),
                expected=float(expected),
                lower=float(lower),
                upper=float(upper),
            )
        )

    return ForecastResponse(
        skill_id=req.skill_id,
        horizon_days=req.horizon_days,
        points=points,
    )
