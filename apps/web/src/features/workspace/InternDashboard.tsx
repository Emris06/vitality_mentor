import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_LOCALE, isLocale, type Locale, type ScenarioId } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { ErpShell, IconBook, IconChat, IconRocket } from './ErpShell';
import { buildWorkspaceSections } from './navigation';
import { useClicky, useClickyEnabled } from '../clicky/ClickyProvider';

// ──────────────────────────────────────────────────────────────────────────
// Intern workspace ("Newcomer" in the brief). Single responsibility: get the
// intern into a simulator scenario fast. Three things, in order:
//   1. What's next on your learning path?
//   2. The Scenario Lab (simulator) — your only "do" surface
//   3. Ask AI when stuck
// No payroll, no cohort stats, no mentor-side actions. The mentor's job is
// not the intern's job.
// ──────────────────────────────────────────────────────────────────────────

interface PathStep {
  id: string;
  title: string;
  scenarioId: ScenarioId | null;
  estMins: number;
  state: 'done' | 'current' | 'locked';
}

// Static demo path that matches the demo seed (KYC is the only live scenario
// in v0; the others render as locked previews so the path feels real).
const LEARNING_PATH: PathStep[] = [
  {
    id: 'intro',
    title: 'Bank floor orientation',
    scenarioId: null,
    estMins: 10,
    state: 'done',
  },
  {
    id: 'kyc',
    title: 'KYC intake — full flow',
    scenarioId: 'kyc',
    estMins: 25,
    state: 'current',
  },
  {
    id: 'open-account',
    title: 'Open account — individual',
    scenarioId: 'open-account',
    estMins: 20,
    state: 'locked',
  },
  {
    id: 'transfer',
    title: 'Transfer & sanctions screening',
    scenarioId: 'transfer',
    estMins: 30,
    state: 'locked',
  },
];

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

  const internName = profile?.fullName ?? 'Intern';
  const current = LEARNING_PATH.find((s) => s.state === 'current');
  const done = LEARNING_PATH.filter((s) => s.state === 'done').length;
  const total = LEARNING_PATH.length;
  const pct = Math.round((done / total) * 100);

  // Clicky onboarding for the intern surface. Greets once on mount, then
  // lets data-clicky-hint attributes drive the rest.
  useClickyEnabled("Hover the Start button — that's your current step.");
  const { pushHint } = useClicky();
  useEffect(() => {
    pushHint(
      current
        ? `Hi ${internName.split(' ')[0]}! Let's start with "${current.title}". Click Start when you're ready.`
        : `Hi ${internName.split(' ')[0]}! Your path is complete — your mentor will assign the next module.`,
      4500,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScenario(scenarioId: PathStep['scenarioId']) {
    if (!scenarioId) return;
    setStarting(true);
    setError(null);
    try {
      const run = await simApi.startRun(scenarioId, locale);
      // KYC has its own runner page; other scenarios fall back to the catalog.
      navigate(scenarioId === 'kyc' ? `/simulator/kyc/${run.id}` : '/simulator');
    } catch (err) {
      setError(err instanceof SimHttpError ? err.message : t('sim.run.load_error'));
      setStarting(false);
    }
  }

  return (
    <ErpShell
      title="Intern desk"
      subtitle="Your learning path"
      userName={internName}
      userRole={t('auth.role_intern_name')}
      sections={buildWorkspaceSections(profile?.role ?? null)}
      searchPlaceholder="Search scenarios and docs"
      topActions={
        current?.scenarioId ? (
          <button
            type="button"
            onClick={() => void startScenario(current.scenarioId)}
            disabled={starting}
            data-clicky-hint={`This launches the "${current.title}" simulator with synthetic data. Safe to experiment — you can't break anything real.`}
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-card hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {starting ? 'Starting…' : `Continue: ${current.title}`}
          </button>
        ) : null
      }
      rightPanel={<InternRightRail done={done} total={total} pct={pct} />}
    >
      <section className="space-y-6">
        <HeroBanner
          internName={internName}
          done={done}
          total={total}
          pct={pct}
          current={current ?? null}
        />

        {error && (
          <div
            className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <article className="rounded-lg border border-ink-200 bg-white shadow-card">
          <header className="border-b border-ink-100 px-5 py-4">
            <h2 className="font-display text-xl text-ink-900">Your learning path</h2>
            <p className="mt-1 text-xs text-ink-500">
              Complete in order. Each step is a synthetic-data simulator run — no real
              clients, no production systems.
            </p>
          </header>
          <ol className="divide-y divide-ink-100">
            {LEARNING_PATH.map((step, idx) => (
              <PathRow
                key={step.id}
                index={idx + 1}
                step={step}
                onStart={() => void startScenario(step.scenarioId)}
                starting={starting}
              />
            ))}
          </ol>
        </article>
      </section>
    </ErpShell>
  );
}

function HeroBanner({
  internName,
  done,
  total,
  pct,
  current,
}: {
  internName: string;
  done: number;
  total: number;
  pct: number;
  current: PathStep | null;
}) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-600">Learn</p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">
            {greeting()}, {internName.split(' ')[0]}.
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {current
              ? `Up next: ${current.title}. About ${current.estMins} minutes.`
              : 'Path complete. Wait for your mentor to assign the next module.'}
          </p>
        </div>
        <div className="min-w-[200px]">
          <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-ink-500">
            <span>Path progress</span>
            <span className="tabular text-ink-900">
              {done}/{total}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] tabular text-ink-500">{pct}% complete</p>
        </div>
      </div>
    </article>
  );
}

function PathRow({
  index,
  step,
  onStart,
  starting,
}: {
  index: number;
  step: PathStep;
  onStart: () => void;
  starting: boolean;
}) {
  const stateUi =
    step.state === 'done'
      ? { dot: 'bg-success-500', label: 'Done', labelClass: 'text-success-700 bg-success-50' }
      : step.state === 'current'
        ? { dot: 'bg-sky-500', label: 'Current', labelClass: 'text-sky-700 bg-sky-50' }
        : { dot: 'bg-ink-200', label: 'Locked', labelClass: 'text-ink-500 bg-ink-50' };

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span
        className={`grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-display ${
          step.state === 'locked' ? 'bg-ink-50 text-ink-400' : 'bg-ink-100 text-ink-700'
        }`}
      >
        {index}
      </span>
      <span className={`h-2 w-2 flex-none rounded-full ${stateUi.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${
            step.state === 'locked' ? 'text-ink-500' : 'text-ink-900'
          }`}
        >
          {step.title}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">~{step.estMins} min</p>
      </div>
      <span
        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stateUi.labelClass}`}
      >
        {stateUi.label}
      </span>
      {step.state === 'current' && step.scenarioId ? (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          data-clicky-hint={`Click to launch "${step.title}" — about ${step.estMins} minutes on synthetic data.`}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Start
        </button>
      ) : step.state === 'done' ? (
        <span className="text-xs text-ink-400">—</span>
      ) : (
        <span
          data-clicky-hint="Locked until you finish your current step. One thing at a time."
          className="rounded-md border border-ink-100 px-3 py-1.5 text-xs text-ink-400"
          title="Unlocks after the current step"
        >
          Locked
        </span>
      )}
    </li>
  );
}

function InternRightRail({
  done,
  total,
  pct,
}: {
  done: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
        <h3 className="font-display text-base text-ink-900">Where you are</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Modules done" value={`${done} / ${total}`} />
          <Row label="Path progress" value={`${pct}%`} />
        </dl>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
        <h3 className="font-display text-base text-ink-900">Need help?</h3>
        <div className="mt-3 space-y-2">
          <Helper
            to="/chat"
            label="Ask AI mentor"
            hint="UZ / RU / EN — answers from internal SOPs"
            icon={<IconChat />}
            clickyHint="Ask anything in Uzbek, Russian, or English. Answers are grounded in internal SOPs — no guessing."
          />
          <Helper
            to="/simulator"
            label="Browse scenarios"
            hint="Outside your path"
            icon={<IconRocket />}
            clickyHint="Optional scenarios outside your path. Try them once your current step is done."
          />
          <Helper
            to="/me"
            label="My badges"
            hint="What you've earned"
            icon={<IconBook />}
            clickyHint="See the badges and XP you've collected as you finish modules."
          />
        </div>
      </section>

      <section className="rounded-lg border border-sky-100 bg-sky-50/40 p-4 shadow-card">
        <h3 className="font-display text-sm text-sky-700">Safe by design</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-700">
          Every scenario uses synthetic data. You can't touch a real customer
          account from here — that's the whole point.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="font-display text-sm tabular text-ink-900">{value}</dd>
    </div>
  );
}

function Helper({
  to,
  label,
  hint,
  icon,
  clickyHint,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
  clickyHint?: string;
}) {
  return (
    <Link
      to={to}
      data-clicky-hint={clickyHint}
      className="group flex items-center gap-3 rounded-md border border-ink-100 bg-white px-3 py-2 transition-colors hover:border-sky-200 hover:bg-sky-50"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-50 text-ink-600 group-hover:bg-sky-100 group-hover:text-sky-700">
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
