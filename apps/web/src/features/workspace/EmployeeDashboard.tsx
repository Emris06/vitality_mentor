import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { hrApi, HrHttpError, type NewcomerListItem } from '../../lib/api';
import { ErpShell, IconChat, IconPeople, IconRocket } from './ErpShell';
import { buildWorkspaceSections } from './navigation';

// ──────────────────────────────────────────────────────────────────────────
// Mentor workspace ("Existing Employee" in the brief = Mentor in practice).
// Single responsibility: surface assigned interns, their progress, and the
// one action a mentor can take fast — open AI knowledge to answer a question.
// No payroll, no budget, no overlap with HR's cohort view.
// ──────────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function EmployeeDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const mentorId = profile?.id ?? null;
  const mentorName = profile?.fullName ?? 'Mentor';
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [allNewcomers, setAllNewcomers] = useState<NewcomerListItem[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);
    hrApi
      .getNewcomers()
      .then((list) => {
        if (cancelled) return;
        setAllNewcomers(list);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof HrHttpError ? err.message : 'Could not load mentees');
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const myMentees = useMemo(() => {
    if (!mentorId) return [];
    return allNewcomers.filter((n) => n.mentor?.id === mentorId);
  }, [allNewcomers, mentorId]);

  const stats = useMemo(() => {
    const total = myMentees.length;
    const avg = total
      ? Math.round(myMentees.reduce((s, n) => s + n.progressPct, 0) / total)
      : 0;
    const stalled = myMentees.filter((n) => n.progressPct < 25).length;
    const finishing = myMentees.filter((n) => n.progressPct >= 80).length;
    return { total, avg, stalled, finishing };
  }, [myMentees]);

  return (
    <ErpShell
      title="Mentor desk"
      subtitle="Your assigned interns"
      userName={mentorName}
      userRole={t('auth.role_employee_name')}
      sections={buildWorkspaceSections(profile?.role ?? null)}
      searchPlaceholder="Search interns by name or department"
      topActions={
        <button
          type="button"
          onClick={() => setAvailable((v) => !v)}
          className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
            available
              ? 'border-warn-200 bg-warn-50 text-warn-700 hover:bg-warn-100'
              : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          <span
            className={`mr-2 inline-block h-2 w-2 rounded-full ${
              available ? 'bg-warn-500' : 'bg-ink-300'
            }`}
          />
          {available ? 'Accepting new mentees' : 'Paused — not accepting'}
        </button>
      }
      rightPanel={<MentorRightRail stats={stats} />}
    >
      <section className="space-y-6">
        <HeroBanner mentorName={mentorName} stats={stats} />

        {state === 'error' && (
          <div
            className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
            role="alert"
          >
            {error ?? 'Failed to load.'}
          </div>
        )}

        <article className="rounded-lg border border-ink-200 bg-white shadow-card">
          <header className="flex items-baseline justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="font-display text-xl text-ink-900">My interns</h2>
              <p className="mt-1 text-xs text-ink-500">
                Pulled from HR assignments. Click an intern to open AI mentor with context.
              </p>
            </div>
            <Link
              to="/chat"
              className="text-xs font-semibold text-warn-700 hover:text-warn-600"
            >
              Open knowledge lookup ›
            </Link>
          </header>

          {state === 'loading' && <MenteesSkeleton />}

          {state === 'ready' && myMentees.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ink-500">
              No interns assigned to you yet. HR will route candidates here when matched.
            </div>
          )}

          {state === 'ready' && myMentees.length > 0 && (
            <ul className="divide-y divide-ink-100">
              {myMentees.map((m) => (
                <MenteeRow key={m.id} mentee={m} />
              ))}
            </ul>
          )}
        </article>
      </section>
    </ErpShell>
  );
}

interface MentorStats {
  total: number;
  avg: number;
  stalled: number;
  finishing: number;
}

function HeroBanner({ mentorName, stats }: { mentorName: string; stats: MentorStats }) {
  return (
    <article className="overflow-hidden rounded-lg border border-warn-100 bg-gradient-to-br from-warn-50 via-white to-white p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-warn-700">Mentor desk</p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">
            {greeting()}, {mentorName.split(' ')[0]}.
          </h1>
          <p className="mt-2 max-w-md text-sm text-ink-600">
            You have <span className="font-semibold text-ink-800">{stats.total}</span> active
            mentee{stats.total === 1 ? '' : 's'}. Average progress{' '}
            <span className="font-semibold text-ink-800">{stats.avg}%</span>.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-center">
          <HeroStat label="Active" value={stats.total} tone="ink" />
          <HeroStat label="Stalled" value={stats.stalled} tone="danger" />
          <HeroStat label="Near done" value={stats.finishing} tone="success" />
        </dl>
      </div>
    </article>
  );
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ink' | 'success' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-success-600'
      : tone === 'danger'
        ? 'text-danger-600'
        : 'text-ink-900';
  return (
    <div>
      <dd className={`font-display text-3xl tabular ${color}`}>{value}</dd>
      <dt className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-500">{label}</dt>
    </div>
  );
}

function MenteeRow({ mentee }: { mentee: NewcomerListItem }) {
  const pct = Math.max(0, Math.min(100, mentee.progressPct));
  const tone = pct >= 80 ? 'success' : pct < 25 ? 'danger' : 'warn';
  const bar =
    tone === 'success'
      ? 'bg-success-500'
      : tone === 'danger'
        ? 'bg-danger-500'
        : 'bg-warn-500';
  return (
    <li className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-ink-50/60">
      <Avatar name={mentee.fullName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/hr/newcomers/${mentee.id}`}
            className="truncate font-semibold text-ink-900 hover:text-warn-700"
          >
            {mentee.fullName}
          </Link>
          <span className="text-xs text-ink-500">
            · {mentee.department ?? 'Unassigned dept'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-12 text-right text-xs tabular text-ink-600">{pct}%</span>
        </div>
      </div>
      <Link
        to="/chat"
        className="rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-warn-200 hover:bg-warn-50 hover:text-warn-700"
      >
        Open chat
      </Link>
    </li>
  );
}

function MenteesSkeleton() {
  return (
    <ul className="divide-y divide-ink-100">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-5 px-5 py-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-ink-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
            <div className="h-1.5 w-full animate-pulse rounded-full bg-ink-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MentorRightRail({ stats }: { stats: MentorStats }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
        <h3 className="font-display text-base text-ink-900">This week</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Active mentees" value={`${stats.total}`} />
          <Row label="Avg progress" value={`${stats.avg}%`} />
          <Row label="Need attention" value={`${stats.stalled}`} tone="danger" />
        </dl>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
        <h3 className="font-display text-base text-ink-900">Mentor shortcuts</h3>
        <div className="mt-3 space-y-2">
          <Shortcut
            to="/chat"
            label="Knowledge lookup"
            hint="Answer a question fast"
            icon={<IconChat />}
          />
          <Shortcut
            to="/simulator"
            label="Scenario catalog"
            hint="Review what interns face"
            icon={<IconRocket />}
          />
          <Shortcut
            to="/me"
            label="My profile"
            hint="Languages, skills, load"
            icon={<IconPeople />}
          />
        </div>
      </section>

      <section className="rounded-lg border border-warn-100 bg-warn-50/40 p-4 shadow-card">
        <h3 className="font-display text-sm text-warn-700">Your role here</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-700">
          Answer escalations from your assigned interns. The AI handles routine
          questions — only the hard ones reach you.
        </p>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd
        className={`font-display text-sm tabular ${
          tone === 'danger' ? 'text-danger-600' : 'text-ink-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Shortcut({
  to,
  label,
  hint,
  icon,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-md border border-ink-100 bg-white px-3 py-2 transition-colors hover:border-warn-200 hover:bg-warn-50"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-50 text-ink-600 group-hover:bg-warn-100 group-hover:text-warn-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-800">{label}</span>
        <span className="block truncate text-[11px] text-ink-500">{hint}</span>
      </span>
      <span className="text-ink-400 transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-warn-100 font-display text-sm text-warn-700">
      {initials || '··'}
    </span>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
