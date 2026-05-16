/**
 * AI-service proxies for the skills surface.
 *
 * Two thin wrappers around the Python `services/ai` HTTP endpoints, each with
 * a tight timeout budget (chatbot SLA is 2s end-to-end; these are background
 * calls so we keep them under that). On timeout or non-200, we fall back to
 * deterministic TS-only logic so the dashboard never breaks.
 *
 *   aiRecommendModules → POST /skills/recommend  (5s budget; rule-based fallback)
 *   aiForecastSkill    → POST /skills/forecast   (3s budget; linear-OLS fallback)
 *
 * The AI agent ships those endpoints in parallel; until they exist, the
 * fallbacks carry the dashboard.
 */

import { request } from 'undici';
import type { Locale, SkillForecast, SkillForecastPoint, SkillGap } from '@vitality/shared';
import { config } from '../config';

// ----- recommend ------------------------------------------------------------

export interface RecommendInput {
  employeeId: string;
  gaps: SkillGap[];
  locale: Locale;
}

export interface RecommendedModule {
  moduleId: string;
  reason: string;
  impactScore: number;     // 0..1
}

/**
 * Calls the AI recommender. If it fails or times out we rank deterministically:
 * one entry per gap, ordered by severity, with an impactScore proportional to
 * (target - current) / target.
 *
 * NOTE: the route layer joins the returned moduleIds with the training_modules
 * table. The fallback returns synthetic ids of the form `mod_<skill>_*`; those
 * may or may not exist in the catalog — the route filters out any that don't
 * resolve, so missing ids degrade gracefully.
 */
export async function aiRecommendModules(
  input: RecommendInput,
): Promise<RecommendedModule[]> {
  try {
    const res = await request(`${config.AI_SERVICE_URL}/skills/recommend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      headersTimeout: 5000,
      bodyTimeout: 5000,
    });
    if (res.statusCode !== 200) throw new Error(`ai_recommend_${res.statusCode}`);
    const json = (await res.body.json()) as { items?: RecommendedModule[] };
    if (!json || !Array.isArray(json.items)) throw new Error('ai_recommend_shape');
    return json.items;
  } catch {
    return fallbackRecommend(input);
  }
}

function fallbackRecommend(input: RecommendInput): RecommendedModule[] {
  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  const sorted = input.gaps
    .slice()
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  // Emit a synthetic "any module for this skill" id; the route resolves it
  // against the catalog and drops unmatched rows. Reason strings stay in
  // English here — the frontend looks at the joined module's `titleKey`
  // for the i18n surface; this reason is mostly diagnostic.
  return sorted.map((g) => {
    const deficit = Math.max(0, g.target - g.current);
    const impact = g.target > 0 ? Math.min(1, deficit / g.target) : 0;
    return {
      moduleId: `mod_${g.skillId}_*`,
      reason: `Close ${g.severity} gap in ${g.skillId} (${g.current}/${g.target} XP)`,
      impactScore: Number(impact.toFixed(3)),
    };
  });
}

// ----- forecast -------------------------------------------------------------

export interface ForecastHistoryPoint {
  date: string;            // YYYY-MM-DD
  xp: number;              // cumulative XP at that date
}

export interface ForecastInput {
  employeeId: string;
  skillId: string;
  history: ForecastHistoryPoint[];
  horizonDays: number;
}

export async function aiForecastSkill(input: ForecastInput): Promise<SkillForecast> {
  try {
    const res = await request(`${config.AI_SERVICE_URL}/skills/forecast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      headersTimeout: 3000,
      bodyTimeout: 3000,
    });
    if (res.statusCode !== 200) throw new Error(`ai_forecast_${res.statusCode}`);
    const json = (await res.body.json()) as Partial<SkillForecast>;
    if (!json || !Array.isArray(json.points) || typeof json.horizonDays !== 'number') {
      throw new Error('ai_forecast_shape');
    }
    return {
      skillId: input.skillId,
      horizonDays: input.horizonDays,
      points: json.points as SkillForecastPoint[],
    };
  } catch {
    return fallbackForecast(input);
  }
}

/**
 * Simple linear OLS over the supplied history. Treats `date` as a day index
 * relative to the earliest point (gaps are fine — we use the actual day
 * offset). The forecast emits one point per day from history-end+1 to
 * history-end + horizonDays, with a ±1.96 * σ confidence band derived from
 * residual stdev (Gaussian assumption — good enough for a demo).
 *
 * Edge cases:
 *   * 0-1 history points → flat-line forecast at the last value, zero band.
 */
function fallbackForecast(input: ForecastInput): SkillForecast {
  const { skillId, horizonDays, history } = input;
  const startISO = new Date().toISOString().slice(0, 10);

  if (history.length === 0) {
    return {
      skillId,
      horizonDays,
      points: buildPoints(startISO, horizonDays, () => ({ expected: 0, lower: 0, upper: 0 })),
    };
  }
  if (history.length === 1) {
    const xp = history[0]!.xp;
    return {
      skillId,
      horizonDays,
      points: buildPoints(startISO, horizonDays, () => ({ expected: xp, lower: xp, upper: xp })),
    };
  }

  // Convert dates to numeric day offsets so we can regress.
  const firstDay = Date.parse(history[0]!.date);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of history) {
    xs.push(Math.round((Date.parse(p.date) - firstDay) / (24 * 3600 * 1000)));
    ys.push(p.xp);
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // Residual standard deviation.
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i]!;
    ss += (ys[i]! - yhat) ** 2;
  }
  const dof = Math.max(1, n - 2);
  const sigma = Math.sqrt(ss / dof);
  const band = 1.96 * sigma;

  // Forecast: x for day k (k = 1..horizonDays after the last history point).
  const lastX = xs[xs.length - 1]!;
  const points: SkillForecastPoint[] = [];
  const lastDateMs = Date.parse(history[history.length - 1]!.date);
  for (let k = 1; k <= horizonDays; k++) {
    const x = lastX + k;
    const expected = intercept + slope * x;
    const date = new Date(lastDateMs + k * 24 * 3600 * 1000).toISOString().slice(0, 10);
    // Clamp lower at 0 — negative cumulative XP makes no sense.
    points.push({
      date,
      expected: Number(expected.toFixed(2)),
      lower: Number(Math.max(0, expected - band).toFixed(2)),
      upper: Number((expected + band).toFixed(2)),
    });
  }
  return { skillId, horizonDays, points };
}

function buildPoints(
  startDate: string,
  days: number,
  fn: (i: number) => { expected: number; lower: number; upper: number },
): SkillForecastPoint[] {
  const startMs = Date.parse(startDate);
  const out: SkillForecastPoint[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date(startMs + i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    out.push({ date, ...fn(i) });
  }
  return out;
}
