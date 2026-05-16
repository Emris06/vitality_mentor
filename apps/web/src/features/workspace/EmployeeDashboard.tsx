import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { gameApi, GameHttpError } from '../../lib/api';
import type { GameProfile } from '../game/types';
import {
  ErpShell,
  IconBook,
  IconChart,
} from './ErpShell';
import { buildWorkspaceSections } from './navigation';

const EMPTY_PROFILE: GameProfile = {
  xpBySkill: {},
  badges: [],
  streak: { current: 0, longest: 0 },
  todayQuest: null,
};

export function EmployeeDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [data, setData] = useState<GameProfile>(EMPTY_PROFILE);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await gameApi.me<GameProfile>();
        if (!cancelled) setData(res);
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof GameHttpError ? error.message : t('game.errors.load_profile'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const totalXp = useMemo(
    () => Object.values(data.xpBySkill).reduce((sum, next) => sum + (Number.isFinite(next) ? next : 0), 0),
    [data.xpBySkill],
  );

  return (
    <ErpShell
      title="Employee Workspace"
      subtitle="CRM/ERP Operations"
      userName={profile?.fullName ?? 'Team Member'}
      userRole={t('auth.role_employee_name')}
      sections={buildWorkspaceSections()}
      searchPlaceholder="Search tasks, docs, or workflows"
      rightPanel={<EmployeeRightRail />}
    >
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 via-white to-white p-5">
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            {profile?.fullName ?? 'Employee'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Workstream overview, learning milestones, and AI assistant access in a single operations panel.
          </p>
        </div>

        {err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {err}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total XP" value={totalXp.toLocaleString()} tone="blue" />
          <Metric label="Current Streak" value={`${data.streak.current} days`} tone="emerald" />
          <Metric label="Badges Earned" value={String(data.badges.length)} tone="amber" />
          <Metric
            label="Today Quest"
            value={data.todayQuest ? `${data.todayQuest.rewardXp} XP` : 'No active quest'}
            tone="slate"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Daily Control Center</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Live
              </span>
            </header>
            <div className="space-y-3">
              <TaskRow title="Review onboarding chats" detail="8 conversations pending QA" status="In progress" />
              <TaskRow title="Finalize compliance summary" detail="Due today at 17:00" status="Priority" />
              <TaskRow title="Complete KYC refresher scenario" detail="Estimated 10 min session" status="Training" />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 grid gap-2">
              <QuickLink to="/chat" label="Open AI Assistant" />
              <QuickLink to="/skills" label="View Skill Gaps" />
              <QuickLink to="/simulator" label="Run Training Scenario" />
              <QuickLink to="/me" label="Open Personal Scoreboard" />
            </div>
          </article>
        </div>
      </section>
    </ErpShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-brand-50 text-brand-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-700';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        KPI
      </span>
    </article>
  );
}

function TaskRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {status}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <span>{label}</span>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </Link>
  );
}

function EmployeeRightRail() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Team Notes</h3>
        <ul className="mt-2 space-y-2 text-xs text-slate-600">
          <li>2 policy updates were published this week.</li>
          <li>Mentor sync starts at 15:00.</li>
          <li>Skills snapshot refreshes every 30 minutes.</li>
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Knowledge Base</h3>
        <div className="mt-2 space-y-2">
          <Link to="/chat" className="flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline">
            <IconBook />
            Ask assistant about procedures
          </Link>
          <Link to="/skills" className="flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline">
            <IconChart />
            Explore role-based skill matrix
          </Link>
        </div>
      </section>
    </div>
  );
}
