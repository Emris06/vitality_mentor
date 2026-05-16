import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import {
  ErpShell,
  IconBook,
  IconChart,
  IconPeople,
  IconRocket,
  IconShield,
} from './ErpShell';
import { buildWorkspaceSections } from './navigation';

export function InternDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  async function startKyc() {
    setStarting(true);
    setError(null);
    try {
      const run = await simApi.startRun('kyc', locale);
      navigate(`/simulator/kyc/${run.id}`);
    } catch (err) {
      setError(err instanceof SimHttpError ? err.message : t('sim.run.load_error'));
      setStarting(false);
    }
  }

  return (
    <ErpShell
      title="Intern Workspace"
      subtitle="Training Operations"
      userName={profile?.fullName ?? 'Intern'}
      userRole={t('auth.role_intern_name')}
      sections={buildWorkspaceSections()}
      searchPlaceholder="Search scenarios, topics, and checkpoints"
      topActions={
        <button
          type="button"
          onClick={() => void startKyc()}
          disabled={starting}
          className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {starting ? 'Starting...' : 'Start KYC'}
        </button>
      }
      rightPanel={<InternRightRail />}
    >
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 via-white to-white p-5">
          <p className="text-sm text-slate-500">Hands-on simulator track</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            {profile?.fullName ?? 'Intern Training'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Complete real-life banking scenarios, collect XP, and unlock mentor-reviewed feedback loops.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="Active Track" value="KYC Onboarding" icon={<IconShield />} />
          <MiniMetric label="Average Session" value="12 min" icon={<IconRocket />} />
          <MiniMetric label="Scenarios Ready" value="1 live / 3 planned" icon={<IconChart />} />
          <MiniMetric label="Mentor Touchpoints" value="3 this week" icon={<IconPeople />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Training Pipeline</h2>
            <div className="mt-4 space-y-3">
              <Pipeline title="Document validation" progress={82} detail="Strong progress in ID checks." />
              <Pipeline title="Sanctions screening" progress={64} detail="Focus on false-positive handling." />
              <Pipeline title="Risk scoring narrative" progress={47} detail="Need cleaner decision explanations." />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 grid gap-2">
              <QuickLink to="/simulator" label="Open Scenario Catalog" />
              <button
                type="button"
                onClick={() => void startKyc()}
                disabled={starting}
                className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>{starting ? 'Launching scenario...' : 'Launch KYC Session'}</span>
                <IconRocket />
              </button>
              <QuickLink to="/chat" label="Ask AI Mentor" />
              <QuickLink to="/me" label="Check XP and Badges" />
            </div>
          </article>
        </div>
      </section>
    </ErpShell>
  );
}

function MiniMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <p className="text-xs uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

function Pipeline({ title, progress, detail }: { title: string; progress: number; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="text-xs font-semibold text-slate-600">{progress}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-600">{detail}</p>
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

function InternRightRail() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Today Schedule</h3>
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <p>09:30 - KYC practice run</p>
          <p>11:00 - Feedback review with mentor</p>
          <p>16:00 - Compliance Q&A</p>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Helpful Links</h3>
        <div className="mt-2 space-y-2">
          <Link to="/simulator" className="flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline">
            <IconShield />
            Scenario library
          </Link>
          <Link to="/chat" className="flex items-center gap-2 text-xs font-medium text-brand-700 hover:underline">
            <IconBook />
            Ask AI mentor
          </Link>
        </div>
      </section>
    </div>
  );
}
