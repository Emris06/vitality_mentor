"""Pure-numpy tests for `app.skills.forecast.forecast`.

No DB, no LLM, no network. We feed a synthetic 30-day linear history with a
known slope and check that the projection lands where simple algebra says
it should, and that the confidence band brackets the expected value.

Run with:

    pytest services/ai/tests/test_skills_forecast.py
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

import pytest

from app.skills.forecast import (
    ForecastRequest,
    HistoryPoint,
    forecast,
)


def _linear_history(
    days: int, slope: float, start_xp: float = 0.0, start: date | None = None
) -> list[HistoryPoint]:
    """Build `days` consecutive HistoryPoints with cumulative XP = start_xp + slope*i."""
    start = start or date(2026, 1, 1)
    return [
        HistoryPoint(
            date=(start + timedelta(days=i)).isoformat(),
            xp=int(round(start_xp + slope * i)),
        )
        for i in range(days)
    ]


def _run(req: ForecastRequest):
    return asyncio.run(forecast(req))


def test_forecast_linear_slope_two_lands_near_240() -> None:
    """30 days of slope-2 history projected 90 days out -> day-90 ≈ 240.

    Math check: the OLS fit on a perfect line y = 2*x recovers slope=2,
    intercept=0. The fit window indexes x=0..29. The first forecast day is
    x=30, so day-90 (offset=89) is x=119. Expected = 2 * 119 + 0 = 238.

    The brief's example called out 240 within tolerance; both numbers fall
    inside our tolerance window. Tolerance is wide on purpose -- numpy's
    polyfit on a perfectly linear input is exact but we don't want this
    test to flake if the fit-window length is tweaked.
    """
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=_linear_history(days=30, slope=2.0),
        horizon_days=90,
    )
    resp = _run(req)
    assert resp.skill_id == "kyc"
    assert resp.horizon_days == 90
    assert resp.points, "expected a non-empty forecast"

    # Last point is the final forecast day.
    last = resp.points[-1]
    # 230 <= expected <= 245 brackets both 238 (exact OLS) and 240 (brief's
    # rough estimate) comfortably.
    assert 230.0 <= last.expected <= 245.0, (
        f"expected day-90 around 238-240, got {last.expected}"
    )


def test_forecast_band_brackets_expected() -> None:
    """`lower <= expected <= upper` must hold at every forecast point.

    On a perfectly linear input the residual std is 0, so lower == expected
    == upper. We still want the invariant to hold (non-strict)."""
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=_linear_history(days=30, slope=2.0),
        horizon_days=90,
    )
    resp = _run(req)
    for p in resp.points:
        assert p.lower <= p.expected <= p.upper, (
            f"band violated at {p.date}: lower={p.lower} "
            f"expected={p.expected} upper={p.upper}"
        )
        # Lower bound must be clamped at zero per the spec.
        assert p.lower >= 0.0


def test_forecast_band_strictly_widens_with_noise() -> None:
    """With non-zero residuals, the band must be strictly wider than the point."""
    # Slope ~2 with deterministic jitter so residual std > 0.
    base = _linear_history(days=30, slope=2.0)
    noisy = [
        HistoryPoint(date=h.date, xp=h.xp + (3 if i % 2 == 0 else -3))
        for i, h in enumerate(base)
    ]
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=noisy,
        horizon_days=90,
    )
    resp = _run(req)
    assert resp.points
    # Pick a middle point -- on slope-2 + jitter the expected is well above
    # zero so the lower-bound clamp at 0 doesn't kick in.
    mid = resp.points[len(resp.points) // 2]
    assert mid.lower < mid.expected < mid.upper


def test_forecast_samples_first_and_last_days() -> None:
    """The sampled output must include the first AND last forecast day."""
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=_linear_history(days=30, slope=2.0),
        horizon_days=90,
    )
    resp = _run(req)
    assert len(resp.points) >= 2
    start = date(2026, 1, 1)
    last_history_day = start + timedelta(days=29)
    first_forecast_day = last_history_day + timedelta(days=1)
    last_forecast_day = last_history_day + timedelta(days=90)
    assert resp.points[0].date == first_forecast_day.isoformat()
    assert resp.points[-1].date == last_forecast_day.isoformat()


def test_forecast_empty_history_returns_empty_points() -> None:
    """No history -> empty point list, not an exception."""
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=[],
        horizon_days=90,
    )
    resp = _run(req)
    assert resp.points == []
    assert resp.skill_id == "kyc"
    assert resp.horizon_days == 90


def test_forecast_single_point_history_does_not_crash() -> None:
    """A single observation has no slope -- expected should stay flat."""
    req = ForecastRequest(
        employee_id="e1",
        skill_id="kyc",
        history=[HistoryPoint(date="2026-01-01", xp=50)],
        horizon_days=14,
    )
    resp = _run(req)
    assert resp.points
    # With zero slope and zero residual, every forecast point should equal 50.
    for p in resp.points:
        assert p.expected == pytest.approx(50.0)
        assert p.lower == pytest.approx(50.0)
        assert p.upper == pytest.approx(50.0)
