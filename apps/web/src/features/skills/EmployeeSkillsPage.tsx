import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts';
import type {
  Locale,
  PromotionReadiness,
  SkillForecast,
  SkillGap,
} from '@vitality/shared';
import { LocalePicker } from '../../components/LocalePicker';
import {
  SkillsHttpError,
  skillsApi,
  type EmployeeSkillProfile,
  type SkillNodeFull,
  type SkillRecommendation,
} from '../../lib/api';
import { ImpactBar } from './ImpactBar';
import {
  BUCKET_BG,
  BUCKET_BG_SOFT,
  BUCKET_TEXT,
  avatarHue,
  initialsOf,
  nodeTarget,
  resolveSkillName,
  severityToBucket,
} from './skillsTheme';

type TargetRoleId = 'senior_compliance' | 'senior_operations';

const TARGET_ROLES: TargetRoleId[] = ['senior_compliance', 'senior_operations'];

/**
 * Deep-dive view for a single employee. Lays out:
 *   1. Skills map  (recharts RadarChart, normalized to taxonomy targets)
 *   2. Gap matrix  (one row per missing skill, clickable → forecast)
 *   3. Readiness   (Ready/Not ready pill, confidence, met/missing)
 *   4. Training    (recommendation cards with impact + minutes)
 *
 * `targetRole` is a radio-pill switch; changing it refetches gaps + readiness +
 * recommendations only — the radar (`profile`) is target-independent.
 */
export function EmployeeSkillsPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const locale = (i18n.resolvedLanguage as Locale) ?? 'en';

  const [targetRole, setTargetRole] = useState<TargetRoleId>('senior_compliance');
  const [profile, setProfile] = useState<EmployeeSkillProfile | null>(null);
  const [taxonomy, setTaxonomy] = useState<SkillNodeFull[]>([]);
  const [gaps, setGaps] = useState<SkillGap[] | null>(null);
  const [readiness, setReadiness] = useState<PromotionReadiness | null>(null);
  const [recs, setRecs] = useState<SkillRecommendation[] | null>(null);
  const [forecastFor, setForecastFor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Profile + taxonomy — target-independent.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setErr(null);
    void (async () => {
      try {
        const [p, tax] = await Promise.all([
          skillsApi.employeeProfile(id),
          skillsApi.taxonomy(),
        ]);
        if (cancelled) return;
        setProfile(p);
        setTaxonomy(tax.nodes);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof SkillsHttpError ? e.message : t('skills.errors.load_employee'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  // Target-dependent payloads.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setGaps(null);
    setReadiness(null);
    setRecs(null);
    void (async () => {
      try {
        const [gapsResp, ready, recsResp] = await Promise.all([
          skillsApi.gaps(id, targetRole),
          skillsApi.readiness(id, targetRole),
          skillsApi.recommendations(id, targetRole, locale),
        ]);
        if (cancelled) return;
        setGaps(gapsResp.gaps);
        setReadiness(ready);
        setRecs(recsResp);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof SkillsHttpError ? e.message : t('skills.errors.load_employee'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, targetRole, locale, t]);

  const taxMap = useMemo(() => {
    const m = new Map<string, SkillNodeFull>();
    for (const n of taxonomy) m.set(n.id, n);
    return m;
  }, [taxonomy]);

  return (
    <main className="min-h-full bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/skills"
              aria-label={t('skills.employee.back')}
              className="grid h-9 w-9 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
            >
              <BackIcon />
            </Link>
            {profile ? (
              <>
                <span
                  className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${avatarHue(
                    profile.employee.id,
                  )} text-sm font-bold text-white`}
                >
                  {initialsOf(profile.employee.fullName)}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-base font-semibold text-ink-900">
                    {profile.employee.fullName}
                  </span>
                  <span className="text-xs text-ink-500">
                    {profile.employee.position ?? profile.employee.role}
                    {profile.employee.department ? ` · ${profile.employee.department}` : ''}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-11 w-44 animate-pulse rounded-xl bg-ink-100" />
            )}
          </div>
          <LocalePicker />
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pb-3 md:px-6">
          <span className="text-xs uppercase tracking-wide text-ink-500">
            {t('skills.target.label')}
          </span>
          <div className="flex flex-wrap gap-1" role="radiogroup">
            {TARGET_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={targetRole === r}
                onClick={() => setTargetRole(r)}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                  (targetRole === r
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
                }
              >
                {t(`skills.target.${r}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-2 md:px-6">
        {err && (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2"
            role="alert"
          >
            {err}
          </div>
        )}

        <SkillsMap profile={profile} taxonomy={taxonomy} />
        <ReadinessCard readiness={readiness} />
        <GapsPanel
          gaps={gaps}
          taxMap={taxMap}
          onPick={(skillId) => setForecastFor(skillId)}
          activeSkillId={forecastFor}
        />
        <RecommendationsPanel
          recs={recs}
          taxMap={taxMap}
        />
      </section>

      <AnimatePresence>
        {forecastFor && (
          <ForecastModal
            key={forecastFor}
            employeeId={id}
            skillId={forecastFor}
            taxMap={taxMap}
            onClose={() => setForecastFor(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// ----- Skill map (radar) -----------------------------------------------------

function SkillsMap({
  profile,
  taxonomy,
}: {
  profile: EmployeeSkillProfile | null;
  taxonomy: SkillNodeFull[];
}) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    if (!profile || taxonomy.length === 0) return [];
    const xpById = new Map<string, number>();
    for (const lv of profile.skills) xpById.set(lv.skillId, lv.xp);
    return [...taxonomy]
      .sort((a, b) => nodeTarget(b) - nodeTarget(a))
      .slice(0, 7)
      .map((n) => {
        const target = nodeTarget(n);
        const xp = xpById.get(n.id) ?? 0;
        return {
          skill: resolveSkillName(t, n.id, n),
          value: target > 0 ? Math.min(1, xp / target) * 100 : 0,
        };
      });
  }, [profile, taxonomy, t]);

  return (
    <Card title={t('skills.employee.skill_map')}>
      {data.length === 0 ? (
        <SkeletonRow />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="#cbd5e1" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fontSize: 11, fill: '#1f2937' }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="#1d4ed8"
              fill="#1d4ed8"
              fillOpacity={0.32}
              isAnimationActive
              animationDuration={650}
            />
            <Tooltip
              formatter={(value: number) => [`${Math.round(value)}%`, 'XP']}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ----- Readiness -------------------------------------------------------------

function ReadinessCard({ readiness }: { readiness: PromotionReadiness | null }) {
  const { t } = useTranslation();

  if (!readiness) {
    return (
      <Card title={t('skills.employee.readiness')}>
        <SkeletonRow />
      </Card>
    );
  }

  const ready = readiness.ready;
  const conf = Math.max(0, Math.min(1, readiness.confidence));
  const confPct = Math.round(conf * 100);

  return (
    <Card title={t('skills.employee.readiness')}>
      <div className="flex items-start justify-between gap-4">
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ' +
            (ready
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800')
          }
        >
          <span
            className={`grid h-5 w-5 place-items-center rounded-full ${
              ready ? 'bg-emerald-600' : 'bg-amber-500'
            } text-white`}
          >
            {ready ? '✓' : '!'}
          </span>
          {ready ? t('skills.readiness.ready') : t('skills.readiness.not_ready')}
        </motion.span>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-500">
            {t('skills.readiness.confidence')}
          </p>
          <p className="text-2xl font-bold tabular-nums text-ink-900">{confPct}%</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <motion.div
          className={`h-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${confPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">
            {t('skills.readiness.met')}
          </p>
          <ul className="mt-1 space-y-1">
            {readiness.metRequirements.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-ink-800">
                <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] text-white">
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
            {readiness.metRequirements.length === 0 && (
              <li className="text-xs text-ink-500">—</li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">
            {t('skills.readiness.missing')}
          </p>
          <ul className="mt-1 space-y-1">
            {readiness.missingRequirements.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-ink-800">
                <span className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[10px] text-white">
                  ·
                </span>
                <span>{r}</span>
              </li>
            ))}
            {readiness.missingRequirements.length === 0 && (
              <li className="text-xs text-ink-500">—</li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}

// ----- Gaps ------------------------------------------------------------------

function GapsPanel({
  gaps,
  taxMap,
  onPick,
  activeSkillId,
}: {
  gaps: SkillGap[] | null;
  taxMap: Map<string, SkillNodeFull>;
  onPick: (skillId: string) => void;
  activeSkillId: string | null;
}) {
  const { t } = useTranslation();

  if (!gaps) {
    return (
      <Card title={t('skills.employee.gaps')}>
        <SkeletonRow />
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card title={t('skills.employee.gaps')}>
        <p className="text-sm text-ink-500">{t('skills.matrix.legend.met')}.</p>
      </Card>
    );
  }

  return (
    <Card title={t('skills.employee.gaps')}>
      <ul className="space-y-2">
        {gaps.map((g, idx) => {
          const bucket = severityToBucket(g.severity);
          const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
          const isActive = activeSkillId === g.skillId;
          return (
            <motion.li
              key={g.skillId}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.04 * idx }}
            >
              <button
                type="button"
                onClick={() => onPick(g.skillId)}
                className={
                  'w-full rounded-xl border bg-white p-3 text-left transition-shadow hover:shadow-md ' +
                  (isActive
                    ? 'border-brand-400 ring-2 ring-brand-200'
                    : 'border-ink-200')
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-ink-900">
                    {resolveSkillName(t, g.skillId, taxMap.get(g.skillId))}
                  </span>
                  <span
                    className={
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                      BUCKET_BG_SOFT[bucket] +
                      ' ' +
                      BUCKET_TEXT[bucket]
                    }
                  >
                    {t(`skills.severity.${g.severity}`)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <motion.div
                      className={`absolute inset-y-0 left-0 ${BUCKET_BG[bucket]}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="w-20 text-right text-[11px] tabular-nums text-ink-600">
                    {g.current} / {g.target}
                  </span>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

// ----- Recommendations -------------------------------------------------------

function RecommendationsPanel({
  recs,
  taxMap,
}: {
  recs: SkillRecommendation[] | null;
  taxMap: Map<string, SkillNodeFull>;
}) {
  const { t } = useTranslation();

  if (!recs) {
    return (
      <Card title={t('skills.employee.recommendations')}>
        <p className="text-sm text-ink-500">{t('skills.recommendations.loading')}</p>
      </Card>
    );
  }

  if (recs.length === 0) {
    return (
      <Card title={t('skills.employee.recommendations')}>
        <p className="text-sm text-ink-500">{t('skills.recommendations.empty')}</p>
      </Card>
    );
  }

  return (
    <Card title={t('skills.employee.recommendations')}>
      <ul className="space-y-3">
        {recs.map((r, idx) => {
          const moduleKey = `skills.modules.${r.moduleId}`;
          const localized = t(moduleKey);
          const title = localized !== moduleKey ? localized : r.title;
          return (
            <motion.li
              key={r.moduleId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.04 * idx }}
              className="rounded-xl border border-ink-200 bg-gradient-to-b from-white to-ink-50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{title}</p>
                  <p className="mt-1 text-xs text-ink-600">{r.reason}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  {resolveSkillName(t, r.skillId, taxMap.get(r.skillId))}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-ink-500">
                    {t('skills.recommendations.impact')}
                  </p>
                  <ImpactBar value={r.impactScore} />
                </div>
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-700">
                  {t('skills.recommendations.minutes', { count: r.estimatedMinutes })}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

// ----- Forecast modal -------------------------------------------------------

function ForecastModal({
  employeeId,
  skillId,
  taxMap,
  onClose,
}: {
  employeeId: string;
  skillId: string;
  taxMap: Map<string, SkillNodeFull>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [horizon, setHorizon] = useState<30 | 60 | 90>(90);
  const [forecast, setForecast] = useState<SkillForecast | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setForecast(null);
    setLoadErr(null);
    void (async () => {
      try {
        const data = await skillsApi.forecast(employeeId, skillId, horizon);
        if (!cancelled) setForecast(data);
      } catch (e) {
        if (cancelled) return;
        setLoadErr(e instanceof SkillsHttpError ? e.message : t('skills.errors.load_forecast'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, skillId, horizon, t]);

  const data = useMemo(() => {
    if (!forecast) return [];
    return forecast.points.map((p) => ({
      label: p.date.slice(5, 10),
      expected: Math.round(p.expected),
      lower: Math.round(p.lower),
      upper: Math.round(p.upper),
      band: [Math.round(p.lower), Math.round(p.upper)] as [number, number],
    }));
  }, [forecast]);

  const escClose = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener('keydown', escClose);
    return () => window.removeEventListener('keydown', escClose);
  }, [escClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 grid place-items-end bg-ink-900/40 backdrop-blur-sm md:place-items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">
              {t('skills.forecast.title')}
            </h3>
            <p className="text-xs text-ink-500">
              {t('skills.forecast.skill_label')}:{' '}
              {resolveSkillName(t, skillId, taxMap.get(skillId))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('skills.forecast.close')}
            className="grid h-8 w-8 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-sm hover:bg-ink-50"
          >
            ×
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-500">
            {t('skills.forecast.horizon')}
          </span>
          {[30, 60, 90].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h as 30 | 60 | 90)}
              aria-pressed={horizon === h}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (horizon === h
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
              }
            >
              {h}d
            </button>
          ))}
        </div>

        <div className="mt-4 h-72">
          {loadErr ? (
            <div className="grid h-full place-items-center text-sm text-rose-700">
              {loadErr}
            </div>
          ) : data.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-ink-500">
              {t('skills.forecast.empty')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill="#1d4ed8"
                  fillOpacity={0.15}
                  name={t('skills.forecast.band')}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#1d4ed8' }}
                  name={t('skills.forecast.expected')}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ----- Layout helpers -------------------------------------------------------

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border border-ink-200 bg-white p-5 shadow-sm ${className ?? ''}`}
    >
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-ink-100" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

