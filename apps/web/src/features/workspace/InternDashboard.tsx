import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { simApi, SimHttpError } from '../../lib/api';
import { useSpeechRecognition } from '../chat/voice/useSpeechRecognition';
import {
  ErpShell,
  IconBook,
  IconChart,
  IconPeople,
  IconRocket,
  IconShield,
} from './ErpShell';
import { buildWorkspaceSections } from './navigation';

const QUICK_LINKS = [
  { label: 'Cohort Roster', icon: '👥' },
  { label: 'Training Calendar', icon: '📅' },
  { label: 'SOP Playbooks', icon: '📋' },
  { label: 'Score Ledger', icon: '🧾' },
  { label: 'Policy Library', icon: '📚' },
];

const TODAY_PLAN = [
  { topic: 'KYC Intake Workflow', trackName: 'Compliance Track A', meta: '21 checkpoints · 40 mins' },
  { topic: 'Sanctions Screening Drill', trackName: 'Compliance Track D', meta: '13 checkpoints · 40 mins' },
  { topic: 'Risk Scoring Basics', trackName: 'Compliance Track D', meta: '13 checkpoints · 35 mins' },
];

const DOCS = [
  { title: 'KYC onboarding score report', at: '05 July, 09:20AM' },
  { title: 'Sanctions audit checklist', at: '05 July, 09:20AM' },
  { title: 'Risk memo assignment pack', at: '05 July, 09:20AM' },
];

const CLASS_PROGRESS = [
  { label: 'KYC Fundamentals', trainees: 37, progress: 72 },
  { label: 'AML Monitoring', trainees: 44, progress: 61 },
  { label: 'Customer Onboarding', trainees: 40, progress: 48 },
  { label: 'Transaction Safety', trainees: 37, progress: 67 },
];

type AgentRunState = 'idle' | 'running' | 'done';

export function InternDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentRunState>('idle');
  const [agentMessage, setAgentMessage] = useState('No background agent running.');
  const [clickyGuide, setClickyGuide] = useState(
    "Ask out loud and I will walk you through this screen. Say 'clicky agent' to start a background agent.",
  );
  const [cursor, setCursor] = useState({ x: 28, y: 120 });
  const timerRef = useRef<number | null>(null);

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

  function startAgentRun(source: 'voice' | 'button') {
    setAgentState('running');
    setAgentMessage(
      source === 'voice'
        ? 'Clicky agent running from voice command: researching best next onboarding steps.'
        : 'Clicky agent running: building a custom onboarding action plan in the background.',
    );
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setAgentState('done');
      setAgentMessage('Clicky agent finished. Open Chat to review recommendations and generated tasks.');
    }, 2600);
  }

  const stt = useSpeechRecognition({
    locale,
    onFinal: (spoken) => {
      const text = spoken.trim();
      if (!text) return;
      const lowered = text.toLowerCase();
      if (lowered.includes('clicky agent')) {
        startAgentRun('voice');
        return;
      }
      setClickyGuide(
        `Heard: "${text}". Next step: open AI Mentor and ask for a step-by-step walkthrough for your current module.`,
      );
    },
    onError: () => {
      setClickyGuide(
        "Voice capture failed. Try again or use the 'Ask AI Mentor' action.",
      );
    },
  });

  useEffect(() => {
    function onMove(ev: PointerEvent) {
      // Place Clicky slightly above-right of the real cursor.
      setCursor({ x: ev.clientX + 12, y: ev.clientY - 16 });
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ErpShell
      title="Intern Workspace"
      subtitle="Guided Onboarding"
      userName={profile?.fullName ?? 'Intern'}
      userRole={t('auth.role_intern_name')}
      sections={buildWorkspaceSections(profile?.role ?? null)}
      searchPlaceholder="Search schedule, docs, and training modules"
      topActions={
        <button
          type="button"
          onClick={() => void startKyc()}
          disabled={starting}
          className="rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {starting ? 'Starting...' : 'Start KYC'}
        </button>
      }
      rightPanel={<InternRightRail onStartKyc={() => void startKyc()} starting={starting} />}
    >
      <section className="space-y-4">
        <ClickyCursor
          x={cursor.x}
          y={cursor.y}
          listening={stt.listening}
        />

        <article className="rounded-lg border border-ink-200 bg-gradient-to-r from-brand-50 via-white to-sky-50 p-5 shadow-card">
          <h1 className="font-display text-4xl text-ink-900">Good morning, {profile?.fullName ?? 'Intern'}!</h1>
          <p className="mt-2 text-base text-ink-700">Have a great day at work.</p>
          <p className="mt-3 text-sm text-ink-600">Important notice: There is a mentor sync at <span className="font-semibold text-brand-700">3 PM</span> today.</p>
        </article>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        )}

        <article className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
          <h2 className="mb-3 font-display text-2xl text-ink-900">Quick Links</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {QUICK_LINKS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="rounded-md border border-ink-200 bg-ink-50 px-3 py-4 text-left hover:border-brand-200 hover:bg-brand-50"
              >
                <p className="text-2xl">{item.icon}</p>
                <p className="mt-2 text-sm font-semibold text-ink-800">{item.label}</p>
              </button>
            ))}
          </div>
        </article>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_0.9fr]">
          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="mb-4 font-display text-2xl text-ink-900">Today's Plan</h2>
            <div className="space-y-3">
              {TODAY_PLAN.map((item) => (
                <div key={item.topic} className="rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-sm font-semibold text-ink-900">{item.topic}</p>
                  <p className="mt-1 text-xs text-brand-700">{item.trackName}</p>
                  <p className="mt-1 text-xs text-ink-600">{item.meta}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink-900">Documents</h2>
              <button type="button" className="text-xs font-semibold text-brand-700">See all</button>
            </div>
            <div className="space-y-3">
              {DOCS.map((doc) => (
                <div key={doc.title} className="rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-sm font-semibold text-ink-900">{doc.title}</p>
                  <p className="mt-1 text-xs text-ink-600">{doc.at}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
            <h2 className="mb-4 font-display text-2xl text-ink-900">Track Progress</h2>
            <div className="space-y-3">
              {CLASS_PROGRESS.map((row) => (
                <div key={row.label} className="rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-sm font-semibold text-ink-900">{row.label}</p>
                  <p className="mt-1 text-xs text-ink-600">{row.trainees} trainees</p>
                  <div className="mt-2 h-2 rounded-full bg-ink-200">
                    <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-brand-500" style={{ width: `${row.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Clicky Agent</h2>
              <p className="text-sm text-ink-600">
                Voice command + background execution for onboarding help.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (stt.listening ? stt.stop() : stt.start())}
                disabled={!stt.supported}
                className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stt.listening ? 'Stop listening' : 'Ask out loud'}
              </button>
              <button
                type="button"
                onClick={() => startAgentRun('button')}
                className="rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Run Clicky Agent
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
              <p className="text-xs uppercase tracking-wide text-ink-500">Voice transcript</p>
              <p className="mt-1 text-sm text-ink-800">
                {stt.transcript || 'Say: "Clicky, explain this step" or "Clicky agent".'}
              </p>
            </div>
            <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
              <p className="text-xs uppercase tracking-wide text-ink-500">Background status</p>
              <p className="mt-1 text-sm text-ink-800">{agentMessage}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  agentState === 'running'
                    ? 'bg-amber-100 text-amber-700'
                    : agentState === 'done'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-ink-100 text-ink-600'
                }`}
              >
                {agentState}
              </span>
            </div>
          </div>
        </article>
      </section>
    </ErpShell>
  );
}

function InternRightRail({
  onStartKyc,
  starting,
}: {
  onStartKyc: () => void;
  starting: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink-900">Schedule</h3>
          <span className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-600">July 2023</span>
        </div>
        <div className="space-y-2 text-sm text-ink-700">
          <p>Mon 3: Compliance standup</p>
          <p>Tue 4: Core banking walkthrough</p>
          <p>Wed 5: Risk review board</p>
        </div>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink-900">Upcoming activities</h3>
          <button type="button" className="text-xs font-semibold text-brand-700">See all</button>
        </div>
        <div className="space-y-2">
          <ActivityItem title="Compliance Standup" subtitle="03:00 PM · Join meet" />
          <ActivityItem title="KYC Practice Run" subtitle="All day" />
        </div>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Notifications</h3>
        <div className="mt-3 space-y-2 text-sm text-ink-700">
          <p>Birthday reminders: 2</p>
          <p>Policy approvals pending: 1</p>
          <p>Case review required: 1</p>
        </div>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Training Actions</h3>
        <div className="mt-3 space-y-2">
          <ActionLink to="/chat" icon={<IconBook />} label="Ask AI Mentor" />
          <ActionLink to="/simulator" icon={<IconShield />} label="Scenario Catalog" />
          <ActionLink to="/skills" icon={<IconChart />} label="Skill Snapshot" />
          <ActionLink to="/me" icon={<IconPeople />} label="XP & Badges" />
          <button
            type="button"
            onClick={onStartKyc}
            disabled={starting}
            className="flex w-full items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span>{starting ? 'Launching...' : 'Launch KYC Session'}</span>
            <IconRocket />
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-3 shadow-card">
        <h3 className="font-display text-lg text-ink-900">Clicky Companion</h3>
        <p className="mt-2 text-sm text-ink-700">
          Clicky sits by your cursor and follows your current page context.
        </p>
        <p className="mt-2 text-xs text-ink-600">
          Voice example: "Clicky, how do I complete sanctions check?" or "clicky agent".
        </p>
      </section>
    </div>
  );
}

function ClickyCursor({
  x,
  y,
  listening,
}: {
  x: number;
  y: number;
  listening: boolean;
}) {
  return (
    <div
      className="pointer-events-none fixed z-40 hidden md:block"
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-hidden="true"
    >
      <span
        className={`absolute -inset-2 rounded-full ${
          listening ? 'animate-pulse bg-sky-400/35' : 'bg-brand-500/28'
        } blur-md`}
      />
      <svg
        viewBox="0 0 24 24"
        className={`relative h-5 w-5 ${
          listening ? 'text-sky-300' : 'text-brand-400'
        } drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]`}
        fill="currentColor"
      >
        <path d="M4 3.5 17.3 12l-6.2 1.7 2.3 6.8-2.5 1.1-2.5-6.8L4 20z" />
      </svg>
    </div>
  );
}

function ActivityItem({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-ink-50 p-2">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="text-xs text-ink-600">{subtitle}</p>
    </div>
  );
}

function ActionLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span>›</span>
    </Link>
  );
}
