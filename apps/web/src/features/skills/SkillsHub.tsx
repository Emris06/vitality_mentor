import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Employee, SkillLevel } from '@vitality/shared';
import { LocalePicker } from '../../components/LocalePicker';
import {
  hrApi,
  HrHttpError,
  SkillsHttpError,
  skillsApi,
  type SkillNodeFull,
  type TeamAnalyticsResponse,
  type TeamGapMatrixResponse,
} from '../../lib/api';
import { Heatmap } from './Heatmap';
import { SkillsRadarMini } from './SkillsRadarMini';
import { avatarHue, initialsOf, resolveSkillName } from './skillsTheme';

type TabId = 'team' | 'matrix' | 'analytics';

/**
 * Top-level page for the Skills Analytics track. Composes three views over the
 * same employee/taxonomy data: a team list with lazy-loaded mini radars, a
 * gap-matrix heatmap, and team-wide analytics charts.
 *
 * Heavy data (`teamGapMatrix`, `teamAnalytics`, and per-employee profiles) is
 * fetched on-demand, never up-front, so the initial render stays snappy.
 */
export function SkillsHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('team');
  const [department, setDepartment] = useState<string | 'all'>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taxonomy, setTaxonomy] = useState<SkillNodeFull[]>([]);
  const [matrix, setMatrix] = useState<TeamGapMatrixResponse | null>(null);
  const [analytics, setAnalytics] = useState<TeamAnalyticsResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Initial load: employees + taxonomy. Both are lightweight and feed every tab.
  useEffect(() => {
    let cancelled = false;
    setErr(null);
    void (async () => {
      try {
        const [emps, tax] = await Promise.all([
          hrApi.getEmployees(),
          skillsApi.taxonomy(),
        ]);
        if (cancelled) return;
        setEmployees(emps);
        setTaxonomy(tax.nodes);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof HrHttpError || e instanceof SkillsHttpError) {
          setErr(e.message);
        } else {
          setErr(t('skills.errors.load_team'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Matrix tab — lazy load.
  useEffect(() => {
    if (tab !== 'matrix' || matrix) return;
    let cancelled = false;
    setMatrixLoading(true);
    void (async () => {
      try {
        const dept = department === 'all' ? undefined : department;
        const data = await skillsApi.teamGapMatrix(dept);
        if (!cancelled) setMatrix(data);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof SkillsHttpError ? e.message : t('skills.errors.load_team'));
      } finally {
        if (!cancelled) setMatrixLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, matrix, department, t]);

  // Analytics tab — lazy load.
  useEffect(() => {
    if (tab !== 'analytics' || analytics) return;
    let cancelled = false;
    setAnalyticsLoading(true);
    void (async () => {
      try {
        const dept = department === 'all' ? undefined : department;
        const data = await skillsApi.teamAnalytics(dept);
        if (!cancelled) setAnalytics(data);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof SkillsHttpError ? e.message : t('skills.errors.load_team'));
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, analytics, department, t]);

  // Re-fetch matrix/analytics on department change. Clear caches.
  useEffect(() => {
    setMatrix(null);
    setAnalytics(null);
  }, [department]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (department === 'all') return employees;
    return employees.filter((e) => e.department === department);
  }, [employees, department]);

  return (
    <main className="min-h-full bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label={t('skills.back')}
              className="grid h-9 w-9 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
            >
              <BackIcon />
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white font-bold">
              AI
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-ink-900">{t('skills.title')}</span>
              <span className="text-xs text-ink-500">{t('skills.subtitle')}</span>
            </div>
          </div>
          <LocalePicker />
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pb-3 md:px-6">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs uppercase tracking-wide text-ink-500">
              {t('skills.department.label')}
            </span>
            <DeptPill
              active={department === 'all'}
              onClick={() => setDepartment('all')}
            >
              {t('skills.department.all')}
            </DeptPill>
            {departments.map((d) => (
              <DeptPill
                key={d}
                active={department === d}
                onClick={() => setDepartment(d)}
              >
                {d}
              </DeptPill>
            ))}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-1 px-4 md:px-6">
          {(['team', 'matrix', 'analytics'] as const).map((id) => (
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
              {t(`skills.tabs.${id}`)}
            </button>
          ))}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {err && (
          <div
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {err}
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <TeamList
                employees={filteredEmployees}
                taxonomy={taxonomy}
                onOpen={(id) => navigate(`/skills/employees/${encodeURIComponent(id)}`)}
              />
            </motion.div>
          )}

          {tab === 'matrix' && (
            <motion.div
              key="matrix"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {matrixLoading || !matrix ? (
                <SkeletonBlock />
              ) : (
                <Heatmap
                  employees={matrix.employees}
                  skills={matrix.skills}
                  cells={matrix.cells}
                />
              )}
            </motion.div>
          )}

          {tab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid gap-4 lg:grid-cols-2"
            >
              {analyticsLoading || !analytics ? (
                <SkeletonBlock className="lg:col-span-2" />
              ) : (
                <>
                  <SkillDistributionChart
                    data={analytics.skillDistribution}
                    taxonomy={taxonomy}
                  />
                  <CompletionVelocityChart data={analytics.completionVelocity} />
                  <MentorEffectivenessChart
                    data={analytics.mentorEffectiveness}
                    className="lg:col-span-2"
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

interface TeamListProps {
  employees: Employee[];
  taxonomy: SkillNodeFull[];
  onOpen: (id: string) => void;
}

function TeamList({ employees, taxonomy, onOpen }: TeamListProps) {
  const { t } = useTranslation();
  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white px-4 py-12 text-center text-sm text-ink-500">
        {t('skills.team.empty')}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((e, idx) => (
        <TeamRow key={e.id} employee={e} taxonomy={taxonomy} delay={0.03 * idx} onOpen={onOpen} />
      ))}
    </div>
  );
}

interface TeamRowProps {
  employee: Employee;
  taxonomy: SkillNodeFull[];
  delay: number;
  onOpen: (id: string) => void;
}

/**
 * One row in the Team tab. The radar is only fetched once the row enters the
 * viewport, via IntersectionObserver — so opening the tab on a 200-employee
 * org doesn't fire 200 simultaneous requests.
 */
function TeamRow({ employee, taxonomy, delay, onOpen }: TeamRowProps) {
  const { t } = useTranslation();
  const [levels, setLevels] = useState<SkillLevel[] | null>(null);
  const [visibleOnce, setVisibleOnce] = useState(false);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node || visibleOnce) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            setVisibleOnce(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '120px' },
    );
    obs.observe(node);
    // No cleanup return needed: observer is disconnected on first hit.
  }, [visibleOnce]);

  useEffect(() => {
    if (!visibleOnce) return;
    let cancelled = false;
    void (async () => {
      try {
        const profile = await skillsApi.employeeProfile(employee.id);
        if (!cancelled) setLevels(profile.skills);
      } catch {
        if (!cancelled) setLevels([]); // empty radar fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleOnce, employee.id]);

  return (
    <motion.div
      ref={refCallback}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={() => onOpen(employee.id)}
      className="group cursor-pointer rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${avatarHue(
            employee.id,
          )} text-sm font-bold text-white`}
        >
          {initialsOf(employee.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{employee.fullName}</p>
          <p className="truncate text-xs text-ink-500">
            {employee.position ?? employee.role}
            {employee.department ? ` · ${employee.department}` : ''}
          </p>
          {employee.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {employee.skills.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {levels ? (
            <SkillsRadarMini nodes={taxonomy} levels={levels} size={60} />
          ) : (
            <div className="h-[60px] w-[60px] animate-pulse rounded-full bg-ink-100" />
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
        {t('skills.team.open')}
        <ChevronIcon />
      </div>
    </motion.div>
  );
}

interface SkillDistributionChartProps {
  data: TeamAnalyticsResponse['skillDistribution'];
  taxonomy: SkillNodeFull[];
}

function SkillDistributionChart({ data, taxonomy }: SkillDistributionChartProps) {
  const { t } = useTranslation();
  const taxMap = useMemo(() => {
    const m = new Map<string, SkillNodeFull>();
    for (const n of taxonomy) m.set(n.id, n);
    return m;
  }, [taxonomy]);

  const rows = useMemo(
    () =>
      data
        .map((d) => ({
          skill: resolveSkillName(t, d.skillId, taxMap.get(d.skillId)),
          p50: Math.round(d.p50),
        }))
        .sort((a, b) => b.p50 - a.p50)
        .slice(0, 10),
    [data, taxMap, t],
  );

  return (
    <ChartCard title={t('skills.analytics.skill_distribution')}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="skill"
            width={110}
            tick={{ fontSize: 11, fill: '#1f2937' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="p50" name="p50" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CompletionVelocityChart({
  data,
}: {
  data: TeamAnalyticsResponse['completionVelocity'];
}) {
  const { t } = useTranslation();
  const rows = useMemo(
    () =>
      data
        .slice(-30)
        .map((p) => ({ label: p.date.slice(5, 10), count: p.scoredRuns })),
    [data],
  );
  return (
    <ChartCard title={t('skills.analytics.completion_velocity')}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 2, fill: '#0ea5e9' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function MentorEffectivenessChart({
  data,
  className,
}: {
  data: TeamAnalyticsResponse['mentorEffectiveness'];
  className?: string;
}) {
  const { t } = useTranslation();
  const rows = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.avgNewcomerScore - a.avgNewcomerScore)
        .slice(0, 8)
        .map((m) => ({ name: m.name, score: Math.round(m.avgNewcomerScore * 10) / 10 })),
    [data],
  );
  return (
    <ChartCard title={t('skills.analytics.mentor_effectiveness')} className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} margin={{ top: 4, right: 12, left: -16, bottom: 24 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            angle={-15}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="score" fill="#10b981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({
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

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`h-72 animate-pulse rounded-2xl border border-ink-200 bg-white ${className ?? ''}`}
    />
  );
}

function DeptPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50')
      }
    >
      {children}
    </button>
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

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
