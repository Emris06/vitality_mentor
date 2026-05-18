import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthProvider';
import { hrApi, HrHttpError, type NewcomerListItem } from '../../lib/api';
import { InternShell, IconBoard, IconChat, IconProfile } from './InternShell';
import { buildMentoraNav } from './mentoraNav';
import { WarmCard } from '../../components/warm/WarmCard';
import { StatCard } from '../../components/warm/StatCard';

// ──────────────────────────────────────────────────────────────────────────
// Mentor workspace (`/employee`) — warm theme (Phase D).
//
// Same behavior as the prior ErpShell version:
//   - hrApi.getNewcomers() on mount → filter to n.mentor?.id === mentorId
//   - "Accepting / paused" toggle is local-only (no API yet)
//   - Rows deep-link to /hr/newcomers/:id; "Open chat" deep-links to /chat
// ──────────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function EmployeeDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const mentorId = profile?.id ?? null;
  const userName = profile?.fullName ?? 'Mentor';
  const firstName = userName.split(/\s+/)[0] ?? userName;
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
        setError(err instanceof HrHttpError ? err.message : t('employee.error.load'));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

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
    <InternShell
      userName={userName}
      userRole={t('auth.role_employee_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('employee.title')}
      navItems={buildMentoraNav('employee')}
      currentScenarioCta={{
        label: available
          ? t('employee.availability.accepting')
          : t('employee.availability.paused'),
        onClick: () => setAvailable((v) => !v),
        clickyTarget: 'available, accepting, paused, toggle, mentees',
        clickyHint:
          'Toggle whether HR can assign new mentees to you. While paused, you remain available for the interns you already mentor.',
      }}
      rightPanel={<MentorRightRail stats={stats} />}
    >
      {state === 'error' && (
        <div
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {error ?? t('employee.error.load')}
        </div>
      )}

      {/* Stat row */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-4 grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label={t('employee.stats.total_mentees')}
          value={stats.total}
          icon={<span className="text-sm">👥</span>}
          tone="mentora"
        />
        <StatCard
          label={t('employee.stats.avg_progress')}
          value={<span>{stats.avg}<span className="text-sm font-medium text-[var(--muted-warm)]">%</span></span>}
          icon={<span className="text-sm">↗</span>}
          tone="coral"
          progress={stats.avg}
        />
        <StatCard
          label={t('employee.stats.stalled_low')}
          value={stats.stalled}
          icon={<span className="text-sm">!</span>}
          tone="amber"
        />
        <StatCard
          label={t('employee.stats.near_done_high')}
          value={stats.finishing}
          icon={<span className="text-sm">★</span>}
          tone="emerald"
        />
      </motion.div>

      {/* My interns */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <WarmCard className="overflow-hidden p-0">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[var(--ink-warm)]">
                {t('employee.mentees.title')}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-warm)]">
                {t('employee.mentees.subtitle')}
              </p>
            </div>
            <Link
              to="/chat"
              data-clicky-target="chat, knowledge, lookup, ai"
              data-clicky-hint="Open the AI knowledge lookup for fast answers."
              className="text-xs font-bold text-coral-600 transition hover:text-coral-700"
            >
              {t('employee.mentees.knowledge_cta')}
            </Link>
          </header>

          {state === 'loading' && <MenteesSkeleton />}

          {state === 'ready' && myMentees.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-[var(--muted-warm)]">
              {t('employee.mentees.empty')}
            </div>
          )}

          {state === 'ready' && myMentees.length > 0 && (
            <ul className="divide-y divide-zinc-100">
              {myMentees.map((m) => (
                <MenteeRow key={m.id} mentee={m} openChatLabel={t('employee.mentees.open_chat')} />
              ))}
            </ul>
          )}
        </WarmCard>
      </motion.div>
    </InternShell>
  );
}

interface MentorStats {
  total: number;
  avg: number;
  stalled: number;
  finishing: number;
}

function MenteeRow({ mentee, openChatLabel }: { mentee: NewcomerListItem; openChatLabel: string }) {
  const pct = Math.max(0, Math.min(100, mentee.progressPct));
  const bar =
    pct >= 80
      ? 'bg-emerald-500'
      : pct < 25
        ? 'bg-rose-500'
        : 'bg-gradient-to-r from-mentora-600 to-mentora-400';
  return (
    <li className="flex items-center gap-5 px-6 py-4 transition-colors hover:bg-cream-50">
      <Avatar name={mentee.fullName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link
            to={`/hr/newcomers/${mentee.id}`}
            data-clicky-target={`mentee, ${mentee.fullName.toLowerCase()}, open, detail`}
            data-clicky-hint={`Open ${mentee.fullName}'s newcomer detail.`}
            className="truncate font-bold text-[var(--ink-warm)] hover:text-mentora-700"
          >
            {mentee.fullName}
          </Link>
          {mentee.department && (
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[var(--muted-warm)]">
              · {mentee.department}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-12 text-right font-mono-tech text-xs font-bold text-[var(--ink-warm-2)]">
            {pct}%
          </span>
        </div>
      </div>
      <Link
        to="/chat"
        data-clicky-target={`open, chat, ${mentee.fullName.toLowerCase()}`}
        data-clicky-hint={`Open the AI mentor chat — useful for drafting an answer to ${mentee.fullName}.`}
        className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-mentora-50 hover:text-mentora-700 hover:ring-mentora-200"
      >
        {openChatLabel}
      </Link>
    </li>
  );
}

function MenteesSkeleton() {
  return (
    <ul className="divide-y divide-zinc-100">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-5 px-6 py-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-1.5 w-full animate-pulse rounded-full bg-zinc-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MentorRightRail({ stats }: { stats: MentorStats }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <WarmCard className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('employee.week.title')}
        </h3>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label={t('employee.week.active_mentees')} value={`${stats.total}`} />
          <Row label={t('employee.week.avg_progress')} value={`${stats.avg}%`} />
          <Row label={t('employee.week.need_attention')} value={`${stats.stalled}`} tone="danger" />
        </dl>
      </WarmCard>

      <WarmCard className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('employee.shortcuts.title')}
        </h3>
        <div className="mt-3 space-y-2">
          <Shortcut
            to="/chat"
            label={t('employee.shortcuts.chat')}
            hint={t('employee.shortcuts.chat_hint')}
            icon={<IconChat />}
            clickyTarget="chat, knowledge, ai, lookup, ask"
            clickyHint="Open the AI knowledge lookup to answer a question fast."
          />
          <Shortcut
            to="/simulator"
            label={t('employee.shortcuts.scenarios')}
            hint={t('employee.shortcuts.scenarios_hint')}
            icon={<IconBoard />}
            clickyTarget="simulator, scenarios, catalog, review"
            clickyHint="Review the scenarios your interns are working through."
          />
          <Shortcut
            to="/me"
            label={t('employee.shortcuts.profile')}
            hint={t('employee.shortcuts.profile_hint')}
            icon={<IconProfile />}
            clickyTarget="profile, me, my account, languages, skills"
            clickyHint="Open your profile — adjust languages, skills, and capacity."
          />
        </div>
      </WarmCard>

      <WarmCard className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-coral-700">
          {t('employee.role.title')}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--ink-warm-2)]">
          {t('employee.role.body')}
        </p>
      </WarmCard>
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
      <dt className="text-xs text-[var(--muted-warm)]">{label}</dt>
      <dd
        className={`font-mono-tech text-sm font-bold ${
          tone === 'danger' ? 'text-rose-600' : 'text-[var(--ink-warm)]'
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
  clickyTarget,
  clickyHint,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
  clickyTarget?: string;
  clickyHint?: string;
}) {
  return (
    <Link
      to={to}
      data-clicky-target={clickyTarget}
      data-clicky-hint={clickyHint}
      className="group flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-zinc-100 transition hover:bg-mentora-50 hover:ring-mentora-200"
    >
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-mentora-50 text-mentora-600 transition group-hover:bg-mentora-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--ink-warm)]">{label}</span>
        <span className="block truncate text-[11px] text-[var(--muted-warm)]">{hint}</span>
      </span>
      <span className="text-zinc-400 transition-transform group-hover:translate-x-0.5">›</span>
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
    <span className="av-amber grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-bold">
      {initials || '··'}
    </span>
  );
}
