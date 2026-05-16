import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Employee, Locale } from '@vitality/shared';
import { LocalePicker } from '../../components/LocalePicker';
import {
  hrApi,
  HrHttpError,
  type HrDashboardSummary,
  type HrStreamEvent,
  type NewcomerListItem,
} from '../../lib/api';
import { ProgressBar } from './ProgressBar';
import { DeadlineBadge } from './DeadlineBadge';
import { MentorPicker } from './MentorPicker';

type TabId = 'overview' | 'newcomers' | 'mentors';

interface VelocityPoint {
  /** Local day key, e.g. "Mon" or short ISO. */
  label: string;
  count: number;
}

/**
 * Count-up animator for the stat tiles. Hook keeps the React tree clean and
 * cancels itself on unmount.
 */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic for a snappier feel.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

interface StatTileProps {
  label: string;
  value: number;
  hint?: string;
  format?: 'int' | 'float1';
}

function StatTile({ label, value, hint, format = 'int' }: StatTileProps) {
  const animated = useCountUp(format === 'int' ? value : Math.round(value * 10));
  const display = format === 'int' ? animated.toString() : (animated / 10).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-b from-white to-ink-50 p-5 shadow-sm"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-600" aria-hidden="true" />
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900">{display}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </motion.div>
  );
}

function bucketize(items: NewcomerListItem[]) {
  const buckets = [0, 0, 0, 0];
  for (const n of items) {
    const p = Math.max(0, Math.min(100, n.progressPct));
    const idx = p >= 75 ? 3 : p >= 50 ? 2 : p >= 25 ? 1 : 0;
    buckets[idx]++;
  }
  return buckets;
}

function langLabel(l: Locale): string {
  return l.toUpperCase();
}

export function HrDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<HrDashboardSummary | null>(null);
  const [newcomers, setNewcomers] = useState<NewcomerListItem[]>([]);
  const [mentors, setMentors] = useState<Employee[]>([]);
  const [loadingErr, setLoadingErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // Mentor tab filters.
  const [filterLang, setFilterLang] = useState<Locale | 'all'>('all');
  const [filterSkill, setFilterSkill] = useState<string | 'all'>('all');

  // Completion velocity series — derived from SSE events received this session.
  // TODO: replace with a real per-day endpoint once the backend exposes one.
  const [velocity, setVelocity] = useState<VelocityPoint[]>(() => initVelocityWindow());

  // Coalesce SSE-triggered refetches so we never have more than one in flight.
  const refetchingNewcomers = useRef(false);
  const refetchingSummary = useRef(false);
  const newcomersPending = useRef(false);
  const summaryPending = useRef(false);

  const fetchNewcomers = useCallback(async () => {
    if (refetchingNewcomers.current) {
      newcomersPending.current = true;
      return;
    }
    refetchingNewcomers.current = true;
    try {
      const list = await hrApi.getNewcomers();
      setNewcomers(list);
    } catch (err) {
      if (err instanceof HrHttpError) setLoadingErr(err.message);
    } finally {
      refetchingNewcomers.current = false;
      if (newcomersPending.current) {
        newcomersPending.current = false;
        void fetchNewcomers();
      }
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (refetchingSummary.current) {
      summaryPending.current = true;
      return;
    }
    refetchingSummary.current = true;
    try {
      const s = await hrApi.getSummary();
      setSummary(s);
    } catch (err) {
      if (err instanceof HrHttpError) setLoadingErr(err.message);
    } finally {
      refetchingSummary.current = false;
      if (summaryPending.current) {
        summaryPending.current = false;
        void fetchSummary();
      }
    }
  }, []);

  const fetchMentors = useCallback(async () => {
    try {
      const list = await hrApi.getEmployees({ role: 'mentor' });
      setMentors(list);
    } catch (err) {
      if (err instanceof HrHttpError) setLoadingErr(err.message);
    }
  }, []);

  // Initial load + SSE subscription.
  useEffect(() => {
    let cancelled = false;
    setLoadingErr(null);
    void fetchNewcomers();
    void fetchSummary();
    void fetchMentors();

    const ctrl = new AbortController();
    void (async () => {
      try {
        for await (const ev of hrApi.streamEvents(ctrl.signal)) {
          if (cancelled) return;
          handleStreamEvent(ev);
        }
      } catch {
        // Stream disconnect / abort — ignore. The page still works without it.
      }
    })();

    function handleStreamEvent(ev: HrStreamEvent) {
      switch (ev.type) {
        case 'hr.assigned':
        case 'hr.unassigned':
        case 'hr.progress':
          void fetchNewcomers();
          void fetchSummary();
          break;
        case 'hr.scored':
          void fetchNewcomers();
          void fetchSummary();
          setVelocity((prev) => bumpToday(prev));
          break;
      }
    }

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [fetchNewcomers, fetchSummary, fetchMentors]);

  const employeesById = useMemo(() => {
    const map: Record<string, Employee> = {};
    for (const m of mentors) map[m.id] = m;
    for (const n of newcomers) {
      if (n.mentor) map[n.mentor.id] = n.mentor;
    }
    return map;
  }, [mentors, newcomers]);

  const filteredNewcomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return newcomers;
    return newcomers.filter((n) => n.fullName.toLowerCase().includes(q));
  }, [newcomers, search]);

  const handleAssignClick = useCallback((newcomerId: string) => {
    setPickerFor(newcomerId);
  }, []);

  const handleUnassign = useCallback(
    async (newcomerId: string) => {
      try {
        await hrApi.unassign(newcomerId);
        void fetchNewcomers();
        void fetchSummary();
      } catch (err) {
        if (err instanceof HrHttpError) setLoadingErr(err.message);
      }
    },
    [fetchNewcomers, fetchSummary],
  );

  const handleExportCsv = useCallback(() => {
    const a = document.createElement('a');
    a.href = hrApi.exportCsvUrl();
    a.download = 'hr-export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const progressChartData = useMemo(() => {
    const [b0, b1, b2, b3] = bucketize(newcomers);
    return [
      { bucket: t('hr.charts.bucket_0_25'), count: b0 },
      { bucket: t('hr.charts.bucket_25_50'), count: b1 },
      { bucket: t('hr.charts.bucket_50_75'), count: b2 },
      { bucket: t('hr.charts.bucket_75_100'), count: b3 },
    ];
  }, [newcomers, t]);

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of mentors) for (const s of m.skills) set.add(s);
    return Array.from(set).sort();
  }, [mentors]);

  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      if (filterLang !== 'all' && !m.languages.includes(filterLang)) return false;
      if (filterSkill !== 'all' && !m.skills.includes(filterSkill)) return false;
      return true;
    });
  }, [mentors, filterLang, filterSkill]);

  const velocityHasData = velocity.some((p) => p.count > 0);

  return (
    <main className="min-h-full bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-9 w-9 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
              aria-label={t('hr.back')}
            >
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
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white font-bold">
              AI
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-ink-900">{t('hr.title')}</span>
              <span className="text-xs text-ink-500">{t('hr.subtitle')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm hover:bg-ink-50"
            >
              {t('hr.newcomers.export_csv')}
            </button>
            <LocalePicker />
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-1 px-4 md:px-6">
          {(['overview', 'newcomers', 'mentors'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
                (tab === id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-600 hover:text-ink-900')
              }
              aria-pressed={tab === id}
            >
              {t(`hr.tabs.${id}`)}
            </button>
          ))}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {loadingErr && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {loadingErr}
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label={t('hr.summary.newcomers_total')}
                  value={summary?.newcomersTotal ?? 0}
                />
                <StatTile label={t('hr.summary.assigned')} value={summary?.assigned ?? 0} />
                <StatTile label={t('hr.summary.unassigned')} value={summary?.unassigned ?? 0} />
                <StatTile
                  label={t('hr.summary.avg_score_7d')}
                  value={summary?.avgScore7d ?? 0}
                  format="float1"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-ink-900">
                    {t('hr.charts.progress_distribution')}
                  </h3>
                  <div className="mt-4 h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progressChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="count" name={t('hr.charts.newcomers_axis')} fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-ink-900">
                    {t('hr.charts.completion_velocity')}
                  </h3>
                  <div className="mt-4 h-56 w-full">
                    {velocityHasData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={velocity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name={t('hr.charts.runs_axis')}
                            stroke="#1d4ed8"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#1d4ed8' }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-ink-500">
                        {t('hr.charts.placeholder_no_data')}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-900">{t('hr.summary.top_mentors')}</h3>
                  <span className="text-xs text-ink-500">{t('hr.summary.scored_7d')}: {summary?.scoredRuns7d ?? 0}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {(summary?.topMentors ?? []).slice(0, 5).map((m, idx) => (
                    <motion.div
                      key={m.employeeId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.04 * idx }}
                      className="rounded-xl border border-ink-200 bg-gradient-to-b from-white to-ink-50 p-3"
                    >
                      <p className="truncate text-sm font-semibold text-ink-900">{m.name}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {m.completedCount} · {t('hr.summary.scored_7d')}
                      </p>
                    </motion.div>
                  ))}
                  {(!summary || summary.topMentors.length === 0) && (
                    <p className="col-span-full text-sm text-ink-500">
                      {t('hr.charts.placeholder_no_data')}
                    </p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {tab === 'newcomers' && (
            <motion.div
              key="newcomers"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('hr.newcomers.search_placeholder') ?? ''}
                  className="w-full max-w-sm rounded-full border border-ink-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <span className="text-xs text-ink-500 tabular-nums">
                  {filteredNewcomers.length} / {newcomers.length}
                </span>
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm md:block">
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="px-4 py-3">{t('hr.newcomers.headers.name')}</th>
                        <th className="px-4 py-3">{t('hr.newcomers.headers.start')}</th>
                        <th className="px-4 py-3">{t('hr.newcomers.headers.deadline')}</th>
                        <th className="px-4 py-3">{t('hr.newcomers.headers.mentor')}</th>
                        <th className="px-4 py-3 w-56">{t('hr.newcomers.headers.progress')}</th>
                        <th className="px-4 py-3 text-right">{t('hr.newcomers.headers.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNewcomers.map((n) => (
                        <tr
                          key={n.id}
                          onClick={() => navigate(`/hr/newcomers/${encodeURIComponent(n.id)}`)}
                          className="cursor-pointer border-t border-ink-100 hover:bg-ink-50/60"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink-900">{n.fullName}</div>
                            {n.department && (
                              <div className="text-xs text-ink-500">{n.department}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-700 tabular-nums">{formatDate(n.startDate)}</td>
                          <td className="px-4 py-3">
                            <DeadlineBadge deadline={n.onboardingDeadline} />
                          </td>
                          <td className="px-4 py-3">
                            {n.mentor ? (
                              <span className="text-ink-800">{n.mentor.fullName}</span>
                            ) : (
                              <span className="text-rose-600">{t('hr.newcomers.no_mentor')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ProgressBar value={n.progressPct} />
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAssignClick(n.id)}
                                className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                              >
                                {n.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                              </button>
                              {n.mentor && (
                                <button
                                  type="button"
                                  onClick={() => void handleUnassign(n.id)}
                                  className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                                >
                                  {t('hr.newcomers.unassign')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredNewcomers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-500">
                            {t('hr.newcomers.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {filteredNewcomers.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm"
                    onClick={() => navigate(`/hr/newcomers/${encodeURIComponent(n.id)}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-900">{n.fullName}</p>
                        {n.department && (
                          <p className="text-xs text-ink-500">{n.department}</p>
                        )}
                      </div>
                      <DeadlineBadge deadline={n.onboardingDeadline} />
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={n.progressPct} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-ink-600">
                      <span>
                        {n.mentor ? n.mentor.fullName : (
                          <span className="text-rose-600">{t('hr.newcomers.no_mentor')}</span>
                        )}
                      </span>
                      <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleAssignClick(n.id)}
                          className="rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          {n.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                        </button>
                        {n.mentor && (
                          <button
                            type="button"
                            onClick={() => void handleUnassign(n.id)}
                            className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-medium text-ink-700"
                          >
                            {t('hr.newcomers.unassign')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredNewcomers.length === 0 && (
                  <p className="rounded-2xl border border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
                    {t('hr.newcomers.empty')}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'mentors' && (
            <motion.div
              key="mentors"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs uppercase tracking-wide text-ink-500">
                    {t('hr.mentors.filter_language')}
                  </span>
                  <FilterPill active={filterLang === 'all'} onClick={() => setFilterLang('all')}>
                    {t('hr.mentors.filter_all')}
                  </FilterPill>
                  {(['en', 'ru', 'uz'] as Locale[]).map((l) => (
                    <FilterPill
                      key={l}
                      active={filterLang === l}
                      onClick={() => setFilterLang(l)}
                    >
                      {langLabel(l)}
                    </FilterPill>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs uppercase tracking-wide text-ink-500">
                    {t('hr.mentors.filter_skill')}
                  </span>
                  <FilterPill active={filterSkill === 'all'} onClick={() => setFilterSkill('all')}>
                    {t('hr.mentors.filter_all')}
                  </FilterPill>
                  {skillOptions.map((s) => (
                    <FilterPill
                      key={s}
                      active={filterSkill === s}
                      onClick={() => setFilterSkill(s)}
                    >
                      {s}
                    </FilterPill>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredMentors.map((m, idx) => {
                  const pct = Math.min(100, Math.round((m.currentLoad / 3) * 100));
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.03 * idx }}
                      className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-semibold text-ink-900">{m.fullName}</h4>
                          {m.department && (
                            <p className="text-xs uppercase tracking-wide text-ink-500">{m.department}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700 tabular-nums">
                          {m.currentLoad} / 3
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-[10px] uppercase tracking-wide text-ink-500">
                          {t('hr.mentors.load')}
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                          <div
                            className={`h-full rounded-full ${m.currentLoad >= 3 ? 'bg-rose-500' : 'bg-brand-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {m.languages.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] uppercase tracking-wide text-ink-500">
                            {t('hr.mentors.languages')}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.languages.map((l) => (
                              <span
                                key={l}
                                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                              >
                                {langLabel(l)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {m.skills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] uppercase tracking-wide text-ink-500">
                            {t('hr.mentors.skills')}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </motion.div>
                  );
                })}
                {filteredMentors.length === 0 && (
                  <p className="col-span-full rounded-2xl border border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
                    {t('hr.mentors.no_mentors')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {pickerFor && (
        <MentorPicker
          newcomerId={pickerFor}
          employeesById={employeesById}
          onClose={() => setPickerFor(null)}
          onAssigned={() => {
            void fetchNewcomers();
            void fetchSummary();
          }}
        />
      )}
    </main>
  );
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function FilterPill({ active, onClick, children }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Initialize the velocity series with the last 7 day labels. */
function initVelocityWindow(): VelocityPoint[] {
  const out: VelocityPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ label: d.toISOString().slice(5, 10), count: 0 });
  }
  return out;
}

/** Bump today's bucket when an `hr.scored` SSE event arrives. */
function bumpToday(series: VelocityPoint[]): VelocityPoint[] {
  if (series.length === 0) return series;
  const next = series.slice();
  const last = next[next.length - 1];
  next[next.length - 1] = { ...last, count: last.count + 1 };
  return next;
}
