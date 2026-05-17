import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../auth/AuthProvider';
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
import { InternShell } from '../workspace/InternShell';
import { buildMentoraNav } from '../workspace/mentoraNav';
import { WarmCard } from '../../components/warm/WarmCard';

// ──────────────────────────────────────────────────────────────────────────
// HR dashboard — warm theme (Phase B).
//
// Same 4-tab structure (Overview / Newcomers / Performance / Mentors) and
// every behavior of the prior ErpShell-based version is preserved:
//   - hrApi.getNewcomers / getSummary / getEmployees / match / assign /
//     unassign / exportCsvUrl
//   - SSE stream via hrApi.streamEvents with the dedup-ref pattern that
//     coalesces concurrent refetches
//   - Mentor matching modal (MentorPicker)
//   - Count-up animated stat tiles
//   - Bar + line charts (recolored to the mentora palette)
//   - URL `?tab=` for deep linking from the sidebar
// ──────────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'newcomers' | 'performance' | 'mentors';

const TAB_IDS: readonly TabId[] = ['overview', 'newcomers', 'performance', 'mentors'];

function isTabId(s: string | null): s is TabId {
  return s !== null && (TAB_IDS as readonly string[]).includes(s);
}

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

type StatTone = 'mentora' | 'coral' | 'amber' | 'emerald';

const TONE_CHIP: Record<StatTone, string> = {
  mentora: 'bg-mentora-50 text-mentora-600',
  coral: 'bg-coral-100 text-coral-600',
  amber: 'bg-amber-100 text-amber-600',
  emerald: 'bg-emerald-100 text-emerald-600',
};

interface StatTileProps {
  label: string;
  value: number;
  hint?: string;
  tone?: StatTone;
  format?: 'int' | 'float1';
  icon?: ReactNode;
}

function StatTile({ label, value, hint, tone = 'mentora', format = 'int', icon }: StatTileProps) {
  const animated = useCountUp(format === 'int' ? value : Math.round(value * 10));
  const display = format === 'int' ? animated.toString() : (animated / 10).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <WarmCard small className="p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          <span className={`grid h-7 w-7 place-items-center rounded-full ${TONE_CHIP[tone]}`}>
            {icon ?? <span className="text-sm">✦</span>}
          </span>
          {label}
        </div>
        <div className="mt-2 font-mono-tech text-3xl font-extrabold text-[var(--ink-warm)]">{display}</div>
        {hint && <div className="mt-1 text-xs text-[var(--muted-warm)]">{hint}</div>}
      </WarmCard>
    </motion.div>
  );
}

function bucketize(items: NewcomerListItem[]) {
  const buckets: [number, number, number, number] = [0, 0, 0, 0];
  for (const n of items) {
    const p = Math.max(0, Math.min(100, n.progressPct));
    const idx = p >= 75 ? 3 : p >= 50 ? 2 : p >= 25 ? 1 : 0;
    buckets[idx] = (buckets[idx] ?? 0) + 1;
  }
  return buckets;
}

function langLabel(l: Locale): string {
  return l.toUpperCase();
}

interface InternPerformanceRow {
  id: string;
  name: string;
  department: string;
  progressPct: number;
  efficiency: number;
  risk: 'low' | 'medium' | 'high';
  mentorName: string | null;
}

export function HrDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = isTabId(searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'overview';
  const setTab = useCallback(
    (id: TabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === 'overview') next.delete('tab');
          else next.set('tab', id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [summary, setSummary] = useState<HrDashboardSummary | null>(null);
  const [newcomers, setNewcomers] = useState<NewcomerListItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
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
      const list = await hrApi.getEmployees();
      setAllEmployees(list);
      setMentors(list.filter((p) => p.role === 'mentor'));
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

  const internPerformance = useMemo<InternPerformanceRow[]>(() => {
    return newcomers.map((n) => {
      const mentorAssigned = Boolean(n.mentor);
      const efficiency = Math.min(
        100,
        Math.max(0, Math.round(n.progressPct * 0.75 + (mentorAssigned ? 25 : 10))),
      );
      const risk: 'low' | 'medium' | 'high' =
        efficiency < 45 ? 'high' : efficiency < 70 ? 'medium' : 'low';
      return {
        id: n.id,
        name: n.fullName,
        department: n.department ?? '—',
        progressPct: n.progressPct,
        efficiency,
        risk,
        mentorName: n.mentor?.fullName ?? null,
      };
    });
  }, [newcomers]);

  const employeePerformance = useMemo(() => {
    return allEmployees
      .filter((e) => e.role === 'employee' || e.role === 'mentor')
      .map((e) => {
        const loadPenalty = e.role === 'mentor' ? Math.max(0, (e.currentLoad - 2) * 18) : 6;
        const skillsBonus = Math.min(14, e.skills.length * 2);
        const languageBonus = Math.min(8, e.languages.length * 2);
        const efficiency = Math.max(25, Math.min(99, Math.round(82 + skillsBonus + languageBonus - loadPenalty)));
        return {
          id: e.id,
          name: e.fullName,
          role: e.role,
          department: e.department ?? '—',
          currentLoad: e.currentLoad,
          skillsCount: e.skills.length,
          efficiency,
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [allEmployees]);

  const performanceSummary = useMemo(() => {
    const internAvg = internPerformance.length
      ? Math.round(
          internPerformance.reduce((acc, r) => acc + r.efficiency, 0) /
            internPerformance.length,
        )
      : 0;
    const employeeAvg = employeePerformance.length
      ? Math.round(
          employeePerformance.reduce((acc, r) => acc + r.efficiency, 0) /
            employeePerformance.length,
        )
      : 0;
    const atRiskInterns = internPerformance.filter((r) => r.risk === 'high').length;
    const mentorCoverage = newcomers.length
      ? Math.round((newcomers.filter((n) => Boolean(n.mentor)).length / newcomers.length) * 100)
      : 0;
    return { internAvg, employeeAvg, atRiskInterns, mentorCoverage };
  }, [employeePerformance, internPerformance, newcomers]);

  const velocityHasData = velocity.some((p) => p.count > 0);
  const userName = profile?.fullName ?? 'HR Manager';
  const firstName = userName.split(/\s+/)[0] ?? userName;
  const dateRange = formatDateRange(i18n.resolvedLanguage ?? 'en');

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_hr_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('hr.title')}
      dateRange={dateRange}
      navItems={buildMentoraNav('hr')}
      currentScenarioCta={{
        label: t('hr.newcomers.export_csv'),
        onClick: handleExportCsv,
        clickyTarget: 'export, csv, download, ispring',
        clickyHint:
          'Download the cohort CSV — the same shape that gets pushed to iSpring nightly.',
      }}
      rightPanel={<HrRightRail summary={summary} newcomers={newcomers} />}
    >
      {loadingErr && (
        <div
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {loadingErr}
        </div>
      )}

      <TabBar tab={tab} setTab={setTab} t={t} />

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <StatTile
                label={t('hr.summary.newcomers_total')}
                value={summary?.newcomersTotal ?? 0}
                tone="mentora"
                icon={<span className="text-sm">👥</span>}
              />
              <StatTile
                label={t('hr.summary.assigned')}
                value={summary?.assigned ?? 0}
                tone="emerald"
                icon={<span className="text-sm">✓</span>}
              />
              <StatTile
                label={t('hr.summary.unassigned')}
                value={summary?.unassigned ?? 0}
                tone="coral"
                icon={<span className="text-sm">!</span>}
              />
              <StatTile
                label={t('hr.summary.avg_score_7d')}
                value={summary?.avgScore7d ?? 0}
                format="float1"
                tone="amber"
                icon={<span className="text-sm">★</span>}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <WarmCard className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                  {t('hr.charts.progress_distribution')}
                </h3>
                <div className="mt-4 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={progressChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#eaecf4" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#8a8fb0' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#8a8fb0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#f1f4ff' }} />
                      <Bar
                        dataKey="count"
                        name={t('hr.charts.newcomers_axis')}
                        fill="#2046ff"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </WarmCard>

              <WarmCard className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                  {t('hr.charts.completion_velocity')}
                </h3>
                <div className="mt-4 h-56 w-full">
                  {velocityHasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={velocity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="#eaecf4" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8a8fb0' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#8a8fb0' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name={t('hr.charts.runs_axis')}
                          stroke="#2046ff"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#2046ff' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-[var(--muted-warm)]">
                      {t('hr.charts.placeholder_no_data')}
                    </div>
                  )}
                </div>
              </WarmCard>
            </div>

            <WarmCard className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                  {t('hr.summary.top_mentors')}
                </h3>
                <span className="font-mono-tech text-xs text-[var(--muted-warm)]">
                  {t('hr.summary.scored_7d')}: {summary?.scoredRuns7d ?? 0}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {(summary?.topMentors ?? []).slice(0, 5).map((m, idx) => (
                  <motion.div
                    key={m.employeeId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.04 * idx }}
                    className="rounded-2xl bg-cream-50 p-3 ring-1 ring-zinc-100"
                  >
                    <p className="truncate text-sm font-bold text-[var(--ink-warm)]">{m.name}</p>
                    <p className="mt-1 font-mono-tech text-xs text-[var(--muted-warm)]">
                      {m.completedCount} · {t('hr.summary.scored_7d')}
                    </p>
                  </motion.div>
                ))}
                {(!summary || summary.topMentors.length === 0) && (
                  <p className="col-span-full text-sm text-[var(--muted-warm)]">
                    {t('hr.charts.placeholder_no_data')}
                  </p>
                )}
              </div>
            </WarmCard>
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
                data-clicky-target="search, filter, newcomer, find, name"
                data-clicky-hint="Filter the newcomer list by name. Local-only — does not refetch."
                className="w-full max-w-sm rounded-full bg-white px-4 py-2 text-sm shadow-chip placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-mentora-600/30"
              />
              <span className="font-mono-tech text-xs text-[var(--muted-warm)]">
                {filteredNewcomers.length} / {newcomers.length}
              </span>
            </div>

            {/* Desktop table */}
            <WarmCard className="hidden overflow-hidden p-0 md:block">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-cream-50 text-left font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('hr.newcomers.headers.name')}</th>
                      <th className="px-4 py-3 font-semibold">{t('hr.newcomers.headers.start')}</th>
                      <th className="px-4 py-3 font-semibold">{t('hr.newcomers.headers.deadline')}</th>
                      <th className="px-4 py-3 font-semibold">{t('hr.newcomers.headers.mentor')}</th>
                      <th className="w-56 px-4 py-3 font-semibold">{t('hr.newcomers.headers.progress')}</th>
                      <th className="px-4 py-3 text-right font-semibold">{t('hr.newcomers.headers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNewcomers.map((n) => (
                      <tr
                        key={n.id}
                        onClick={() => navigate(`/hr/newcomers/${encodeURIComponent(n.id)}`)}
                        data-clicky-target={`${n.fullName.toLowerCase()}, newcomer, intern, row, detail`}
                        data-clicky-hint={`Open ${n.fullName}'s detail page.`}
                        className="cursor-pointer border-t border-zinc-100 hover:bg-cream-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-[var(--ink-warm)]">{n.fullName}</div>
                          {n.department && (
                            <div className="text-xs text-[var(--muted-warm)]">{n.department}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-tech text-[var(--ink-warm-2)]">{formatDate(n.startDate)}</td>
                        <td className="px-4 py-3">
                          <DeadlineBadge deadline={n.onboardingDeadline} />
                        </td>
                        <td className="px-4 py-3">
                          {n.mentor ? (
                            <span className="text-[var(--ink-warm-2)]">{n.mentor.fullName}</span>
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
                              data-clicky-target={`assign, ${n.mentor ? 'reassign' : 'pick'}, mentor, ${n.fullName.toLowerCase()}`}
                              data-clicky-hint={
                                n.mentor
                                  ? `Pick a different mentor for ${n.fullName}.`
                                  : `Assign a mentor to ${n.fullName}.`
                              }
                              className="rounded-md bg-mentora-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-mentora-700"
                            >
                              {n.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                            </button>
                            {n.mentor && (
                              <button
                                type="button"
                                onClick={() => void handleUnassign(n.id)}
                                className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
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
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted-warm)]">
                          {t('hr.newcomers.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WarmCard>

            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {filteredNewcomers.map((n) => (
                <WarmCard
                  key={n.id}
                  small
                  className="cursor-pointer p-4"
                >
                  <div
                    onClick={() => navigate(`/hr/newcomers/${encodeURIComponent(n.id)}`)}
                    data-clicky-target={`${n.fullName.toLowerCase()}, newcomer, intern, card, detail`}
                    data-clicky-hint={`Open ${n.fullName}'s detail page.`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[var(--ink-warm)]">{n.fullName}</p>
                        {n.department && (
                          <p className="text-xs text-[var(--muted-warm)]">{n.department}</p>
                        )}
                      </div>
                      <DeadlineBadge deadline={n.onboardingDeadline} />
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={n.progressPct} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-warm-2)]">
                      <span>
                        {n.mentor ? n.mentor.fullName : (
                          <span className="text-rose-600">{t('hr.newcomers.no_mentor')}</span>
                        )}
                      </span>
                      <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleAssignClick(n.id)}
                          className="rounded-md bg-mentora-600 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          {n.mentor ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                        </button>
                        {n.mentor && (
                          <button
                            type="button"
                            onClick={() => void handleUnassign(n.id)}
                            className="rounded-md bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200"
                          >
                            {t('hr.newcomers.unassign')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </WarmCard>
              ))}
              {filteredNewcomers.length === 0 && (
                <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[var(--muted-warm)] ring-1 ring-zinc-100">
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
                <span className="mr-1 font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
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
                <span className="mr-1 font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMentors.map((m, idx) => {
                const pct = Math.min(100, Math.round((m.currentLoad / 3) * 100));
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.03 * idx }}
                    data-clicky-target={`${m.fullName.toLowerCase()}, mentor, employee, card`}
                    data-clicky-hint={`Mentor ${m.fullName}. Current load ${m.currentLoad}/3.`}
                  >
                    <WarmCard small className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-bold text-[var(--ink-warm)]">{m.fullName}</h4>
                          {m.department && (
                            <p className="font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">{m.department}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono-tech text-[11px] font-bold text-zinc-700">
                          {m.currentLoad} / 3
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="font-mono-tech text-[10px] uppercase tracking-wider text-[var(--muted-warm)]">
                          {t('hr.mentors.load')}
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full ${m.currentLoad >= 3 ? 'bg-rose-500' : 'bg-mentora-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {m.languages.length > 0 && (
                        <div className="mt-3">
                          <p className="font-mono-tech text-[10px] uppercase tracking-wider text-[var(--muted-warm)]">
                            {t('hr.mentors.languages')}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.languages.map((l) => (
                              <span
                                key={l}
                                className="rounded-full bg-mentora-50 px-2 py-0.5 text-[11px] font-semibold text-mentora-700"
                              >
                                {langLabel(l)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {m.skills.length > 0 && (
                        <div className="mt-3">
                          <p className="font-mono-tech text-[10px] uppercase tracking-wider text-[var(--muted-warm)]">
                            {t('hr.mentors.skills')}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </WarmCard>
                  </motion.div>
                );
              })}
              {filteredMentors.length === 0 && (
                <p className="col-span-full rounded-2xl bg-white px-4 py-8 text-center text-sm text-[var(--muted-warm)] ring-1 ring-zinc-100">
                  {t('hr.mentors.no_mentors')}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'performance' && (
          <motion.div
            key="performance"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* TODO: i18n — keys below were hardcoded English in the previous version. */}
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <StatTile label="Intern Efficiency (avg)" value={performanceSummary.internAvg} hint="From progress + mentor coverage" tone="mentora" icon={<span className="text-sm">★</span>} />
              <StatTile label="Employee Efficiency (avg)" value={performanceSummary.employeeAvg} hint="From load, skills, languages" tone="emerald" icon={<span className="text-sm">★</span>} />
              <StatTile label="At-Risk Interns" value={performanceSummary.atRiskInterns} hint="Efficiency < 45" tone="coral" icon={<span className="text-sm">!</span>} />
              <StatTile label="Mentor Coverage" value={performanceSummary.mentorCoverage} hint="% interns with a mentor" tone="amber" icon={<span className="text-sm">%</span>} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <WarmCard className="overflow-hidden p-0">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                    Intern Performance &amp; Mentor Assignment
                  </h3>
                </div>
                <div className="max-h-[56vh] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-cream-50 text-left font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Intern</th>
                        <th className="px-4 py-3 font-semibold">Progress</th>
                        <th className="px-4 py-3 font-semibold">Efficiency</th>
                        <th className="px-4 py-3 font-semibold">Mentor</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internPerformance.map((row) => (
                        <tr key={row.id} className="border-t border-zinc-100 hover:bg-cream-50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-[var(--ink-warm)]">{row.name}</div>
                            <div className="text-xs text-[var(--muted-warm)]">{row.department}</div>
                          </td>
                          <td className="px-4 py-3">
                            <ProgressBar value={row.progressPct} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 font-mono-tech text-xs font-bold ${efficiencyBadgeClass(row.risk)}`}>
                              {row.efficiency}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--ink-warm-2)]">
                            {row.mentorName ?? <span className="text-rose-600">{t('hr.newcomers.no_mentor')}</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAssignClick(row.id)}
                                className="rounded-md bg-mentora-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-mentora-700"
                              >
                                {row.mentorName ? t('hr.newcomers.reassign') : t('hr.newcomers.assign')}
                              </button>
                              {row.mentorName && (
                                <button
                                  type="button"
                                  onClick={() => void handleUnassign(row.id)}
                                  className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                                >
                                  {t('hr.newcomers.unassign')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {internPerformance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted-warm)]">
                            No intern data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </WarmCard>

              <WarmCard className="overflow-hidden p-0">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                    Employee Performance &amp; Efficiency
                  </h3>
                </div>
                <div className="max-h-[56vh] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-cream-50 text-left font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">Skills</th>
                        <th className="px-4 py-3 font-semibold">Load</th>
                        <th className="px-4 py-3 font-semibold">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeePerformance.map((row) => {
                        const risk: 'low' | 'medium' | 'high' =
                          row.efficiency < 50
                            ? 'high'
                            : row.efficiency < 72
                              ? 'medium'
                              : 'low';
                        return (
                          <tr key={row.id} className="border-t border-zinc-100 hover:bg-cream-50">
                            <td className="px-4 py-3">
                              <div className="font-bold text-[var(--ink-warm)]">{row.name}</div>
                              <div className="text-xs text-[var(--muted-warm)]">{row.department}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                {row.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono-tech text-[var(--ink-warm-2)]">{row.skillsCount}</td>
                            <td className="px-4 py-3 font-mono-tech text-[var(--ink-warm-2)]">{row.currentLoad}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 font-mono-tech text-xs font-bold ${efficiencyBadgeClass(risk)}`}>
                                {row.efficiency}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {employeePerformance.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted-warm)]">
                            No employee data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </WarmCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </InternShell>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Tab bar
// ───────────────────────────────────────────────────────────────────────

function TabBar({
  tab,
  setTab,
  t,
}: {
  tab: TabId;
  setTab: (id: TabId) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-white p-1 shadow-chip">
      {TAB_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          aria-pressed={tab === id}
          data-clicky-target={`${id}, tab, ${t(`hr.tabs.${id}`).toLowerCase()}`}
          data-clicky-hint={`Switch to the ${t(`hr.tabs.${id}`)} tab.`}
          className={
            'rounded-full px-3.5 py-1.5 text-sm font-semibold transition ' +
            (tab === id
              ? 'bg-[var(--ink-warm)] text-white'
              : 'text-[var(--ink-warm-2)] hover:bg-cream-50')
          }
        >
          {t(`hr.tabs.${id}`)}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Right rail
// ───────────────────────────────────────────────────────────────────────

function HrRightRail({
  summary,
  newcomers,
}: {
  summary: HrDashboardSummary | null;
  newcomers: NewcomerListItem[];
}) {
  const topDue = [...newcomers]
    .sort((a, b) => a.onboardingDeadline.localeCompare(b.onboardingDeadline))
    .slice(0, 4);

  return (
    <>
      <WarmCard small className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          Schedule
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-[var(--ink-warm-2)]">
          <li>Daily mentor assignment sync</li>
          <li>15:00 performance review board</li>
          <li>Export cycle: weekly every Friday</li>
        </ul>
      </WarmCard>

      <WarmCard small className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          Top mentors
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-[var(--ink-warm-2)]">
          {(summary?.topMentors ?? []).slice(0, 4).map((mentor) => (
            <li key={mentor.employeeId} className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-[var(--ink-warm)]">{mentor.name}</span>
              <span className="font-mono-tech font-bold">{mentor.completedCount}</span>
            </li>
          ))}
          {(!summary || summary.topMentors.length === 0) && (
            <li className="text-[var(--muted-warm)]">No mentor data yet.</li>
          )}
        </ul>
      </WarmCard>

      <WarmCard small className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          Upcoming deadlines
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-[var(--ink-warm-2)]">
          {topDue.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-[var(--ink-warm)]">{person.fullName}</span>
              <span className="font-mono-tech">{formatDate(person.onboardingDeadline)}</span>
            </li>
          ))}
          {topDue.length === 0 && (
            <li className="text-[var(--muted-warm)]">No active newcomers.</li>
          )}
        </ul>
      </WarmCard>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Filter pill (Mentors tab)
// ───────────────────────────────────────────────────────────────────────

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
      aria-pressed={active}
      className={
        'rounded-full px-3 py-1 text-xs font-semibold transition ' +
        (active
          ? 'bg-mentora-600 text-white shadow-sm'
          : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50')
      }
    >
      {children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function localeToBcp47(l: string): string {
  switch (l) {
    case 'uz':
      return 'uz-UZ';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

function formatDateRange(locale: string): string {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const short = new Intl.DateTimeFormat(localeToBcp47(locale), {
    month: 'short',
    day: 'numeric',
  });
  const full = new Intl.DateTimeFormat(localeToBcp47(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${short.format(start)} — ${full.format(today)}`;
}

function efficiencyBadgeClass(risk: 'low' | 'medium' | 'high'): string {
  if (risk === 'high') return 'bg-rose-50 text-rose-700';
  if (risk === 'medium') return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
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
  if (!last) return series;
  next[next.length - 1] = { ...last, count: last.count + 1 };
  return next;
}
