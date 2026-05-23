import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type ScenarioId,
} from '@vitality/shared';
import {
  gameApi,
  internApi,
  simApi,
  SimHttpError,
  type InternActivityEntry,
  type InternMe,
} from '../../lib/api';
import type { GameProfile } from '../game/types';
import { InternShell } from './InternShell';
import { MentoraMark } from '../../components/warm/MentoraMark';
import { WarmCard } from '../../components/warm/WarmCard';
import { StatCard, type StatTone } from '../../components/warm/StatCard';
import {
  ScenarioRow,
  type ScenarioIconTone,
  type ScenarioStatus,
} from '../../components/warm/ScenarioRow';
import { ActivityRow } from '../../components/warm/ActivityRow';
import { CohortTile, type AvatarTone } from '../../components/warm/CohortTile';
import { TaskRow, type XpTone } from '../../components/warm/TaskRow';

// ──────────────────────────────────────────────────────────────────────────
// Intern dashboard — v3 (warm-theme).
//
// One screen, four jobs:
//   1. Daily stat band (gameApi.me) — pulls intern back tomorrow.
//   2. Active scenario hero — one tap, runs simApi.startRun → KYC runner.
//   3. Scenarios list — what's mastered, what's next, what's locked.
//   4. Right rail — today's tasks, mentor + cohort activity, cohort tiles.
//
// Everything pulls real data where the backend exposes it (game profile,
// learning path). Cohort + activity + tasks are still hardcoded; see TODOs.
// ──────────────────────────────────────────────────────────────────────────

interface PathStep {
  id: string;
  scenarioId: ScenarioId | null;
  titleKey: string;
  moduleKey: string;
  state: 'done' | 'current' | 'locked';
  estMins: number;
}

const LEARNING_PATH: readonly PathStep[] = [
  {
    id: 'orientation',
    scenarioId: null,
    titleKey: 'intern.dashboard.scenarios.item.orientation',
    moduleKey: 'intern.dashboard.scenarios.module.orientation',
    state: 'done',
    estMins: 10,
  },
  {
    id: 'kyc',
    scenarioId: 'kyc',
    titleKey: 'intern.dashboard.scenarios.item.kyc',
    moduleKey: 'intern.dashboard.scenarios.module.retail_ops',
    state: 'current',
    estMins: 25,
  },
  {
    id: 'open-account',
    scenarioId: 'open-account',
    titleKey: 'intern.dashboard.scenarios.item.open_account',
    moduleKey: 'intern.dashboard.scenarios.module.retail_ops',
    state: 'locked',
    estMins: 20,
  },
  {
    id: 'transfer',
    scenarioId: 'transfer',
    titleKey: 'intern.dashboard.scenarios.item.transfer',
    moduleKey: 'intern.dashboard.scenarios.module.payments',
    state: 'locked',
    estMins: 30,
  },
];

// Visual mapping per scenario id → icon + tone for the scenarios list.
const SCENARIO_VISUAL: Record<string, { icon: string; tone: ScenarioIconTone }> = {
  orientation: { icon: '🧭', tone: 'emerald' },
  kyc: { icon: '📋', tone: 'mentora' },
  'open-account': { icon: '💳', tone: 'violet' },
  transfer: { icon: '↔', tone: 'rose' },
};

// Level threshold — same constant as the mockup's "Level 4 · 420 / 600 XP".
// TODO: replace with a backend-owned curve once gameApi exposes one.
const XP_PER_LEVEL = 600;
const STREAK_CONSISTENT = 5;

// Fallback onboarding deadline when gameApi.me doesn't return one. Matches
// the existing DeadlineRing fallback in features/game/DeadlineRing.tsx.
const STUB_ONBOARDING_DEADLINE = '2026-08-31';

export function InternDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [game, setGame] = useState<GameProfile | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [gameLoadFailed, setGameLoadFailed] = useState(false);
  const [internData, setInternData] = useState<InternMe | null>(null);
  const [activityData, setActivityData] = useState<InternActivityEntry[] | null>(null);

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const internName = profile?.fullName ?? 'Intern';
  const firstName = internName.split(/\s+/)[0] ?? internName;
  const current = LEARNING_PATH.find((s) => s.state === 'current') ?? null;
  const doneCount = LEARNING_PATH.filter((s) => s.state === 'done').length;
  const totalSteps = LEARNING_PATH.length;

  // Load gamification profile + intern aggregates + activity in parallel.
  // Single shot on mount — revisiting the route refetches. Each call's
  // error is contained so a flaky endpoint can't blank the whole dashboard.
  useEffect(() => {
    let cancelled = false;
    setGameLoading(true);
    setGameLoadFailed(false);
    void (async () => {
      const [gameResult, internResult, activityResult] = await Promise.allSettled([
        gameApi.me<GameProfile>(),
        internApi.me(),
        internApi.activity(),
      ]);
      if (cancelled) return;
      if (gameResult.status === 'fulfilled') {
        setGame(gameResult.value);
      } else {
        setGame(null);
        setGameLoadFailed(true);
      }
      if (internResult.status === 'fulfilled') {
        setInternData(internResult.value);
      } else {
        setInternData(null);
      }
      if (activityResult.status === 'fulfilled') {
        setActivityData(activityResult.value);
      } else {
        setActivityData(null);
      }
      setGameLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startScenario(scenarioId: ScenarioId | null) {
    if (!scenarioId) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await simApi.startRun(scenarioId, locale);
      navigate(scenarioId === 'kyc' ? `/simulator/kyc/${run.id}` : '/simulator');
    } catch (err) {
      setStartError(
        err instanceof SimHttpError ? err.message : t('sim.run.load_error'),
      );
      setStarting(false);
    }
  }

  const stats = useMemo(() => deriveStats(game, locale, t), [game, locale, t]);
  const currentTitle = current ? t(current.titleKey) : '';
  const dateRange = useMemo(() => formatDateRange(locale), [locale]);

  return (
    <InternShell
      userName={internName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('intern.shell.page_title')}
      dateRange={dateRange}
      currentScenarioCta={
        current?.scenarioId
          ? {
              label: starting
                ? t('intern.dashboard.starting')
                : t('intern.dashboard.continue_cta', { title: currentTitle }),
              onClick: () => void startScenario(current.scenarioId),
              disabled: starting,
              clickyTarget:
                'start, continue, begin, kyc, scenario, current, simulator',
              clickyHint: `This launches "${currentTitle}" with synthetic data. Safe to experiment — you can't break anything real.`,
            }
          : undefined
      }
      rightPanel={
        <RightRail
          t={t}
          internData={internData}
          activityData={activityData}
          loading={gameLoading}
        />
      }
    >
      {(startError || gameLoadFailed) && (
        <ErrorBanner
          message={
            startError ?? t('intern.dashboard.errors.game_load_failed')
          }
        />
      )}

      <StatCardsRow stats={stats} loading={gameLoading} />

      <ActiveScenarioHero
        current={current}
        currentTitle={currentTitle}
        starting={starting}
        doneCount={doneCount}
        totalSteps={totalSteps}
        onContinue={() => void startScenario(current?.scenarioId ?? null)}
        t={t}
      />

      <ScenariosCard path={LEARNING_PATH} t={t} />
    </InternShell>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Stat cards row
// ───────────────────────────────────────────────────────────────────────

interface DerivedStats {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  levelPct: number;
  streakDays: number;
  streakSubline: string;
  badgesCount: number;
  badgesSubline: string;
  daysUntilDeadline: number;
  deadlineSubline: string;
}

function deriveStats(
  game: GameProfile | null,
  locale: Locale,
  t: (key: string, opts?: Record<string, unknown>) => string,
): DerivedStats {
  const totalXp = game
    ? Object.values(game.xpBySkill).reduce(
        (a, b) => a + (Number.isFinite(b) ? b : 0),
        0,
      )
    : 0;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const xpForNext = XP_PER_LEVEL;
  const levelPct = (xpInLevel / xpForNext) * 100;

  const streakDays = game?.streak.current ?? 0;
  const streakSubline =
    streakDays === 0
      ? t('intern.dashboard.stats.streak_subline_none')
      : streakDays >= STREAK_CONSISTENT
        ? t('intern.dashboard.stats.streak_subline_great')
        : t('intern.dashboard.stats.streak_subline_next', {
            count: STREAK_CONSISTENT - streakDays,
          });

  const badgesCount = game?.badges.length ?? 0;
  const recentBadge = game?.badges[0];
  const badgesSubline =
    badgesCount === 0
      ? t('intern.dashboard.stats.badges_none')
      : recentBadge
        ? t('intern.dashboard.stats.badges_recent', {
            name: t(recentBadge.nameKey, { defaultValue: recentBadge.id }),
          })
        : '';

  const deadlineIso = game?.onboardingDeadline ?? STUB_ONBOARDING_DEADLINE;
  const deadlineDate = new Date(deadlineIso);
  const today = new Date();
  const dayMs = 1000 * 60 * 60 * 24;
  const daysUntilDeadline = Math.max(
    0,
    Math.ceil((deadlineDate.getTime() - today.getTime()) / dayMs),
  );
  const deadlineSubline = Number.isNaN(deadlineDate.getTime())
    ? t('intern.dashboard.stats.onboarding_overdue')
    : daysUntilDeadline === 0
      ? t('intern.dashboard.stats.onboarding_overdue')
      : t('intern.dashboard.stats.onboarding_deadline', {
          date: formatShortDate(deadlineDate, locale),
        });

  return {
    level,
    xpInLevel,
    xpForNext,
    levelPct,
    streakDays,
    streakSubline,
    badgesCount,
    badgesSubline,
    daysUntilDeadline,
    deadlineSubline,
  };
}

function StatCardsRow({
  stats,
  loading,
}: {
  stats: DerivedStats;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      aria-busy={loading}
      data-clicky-target="stats, status, summary, progress, dashboard"
      data-clicky-hint="Your level, current streak, badges, and onboarding countdown."
    >
      <div data-clicky-target="level, xp, points, rank" data-clicky-hint={t('clicky.hint.stats.level')}>
        <StatCard
          label={t('intern.dashboard.stats.level_label')}
          tone={'mentora' as StatTone}
          icon={<span className="text-sm">✦</span>}
          value={stats.level}
          valueSuffix={t('intern.dashboard.stats.level_progress', {
            xp: stats.xpInLevel,
            next: stats.xpForNext,
          })}
          progress={stats.levelPct}
        />
      </div>
      <div data-clicky-target="streak, days, consistency, fire" data-clicky-hint={t('clicky.hint.stats.streak')}>
        <StatCard
          label={t('intern.dashboard.stats.streak_label')}
          tone="coral"
          icon={<span className="text-sm">🔥</span>}
          value={
            <>
              {stats.streakDays}{' '}
              <span className="text-sm font-medium text-[var(--muted-warm)]">
                {t('intern.dashboard.stats.streak_days', {
                  count: stats.streakDays,
                }).replace(/^\d+\s*/, '')}
              </span>
            </>
          }
          subline={stats.streakSubline}
        />
      </div>
      <div data-clicky-target="badges, achievements, trophy, awards" data-clicky-hint={t('clicky.hint.stats.badges')}>
        <StatCard
          label={t('intern.dashboard.stats.badges_label')}
          tone="amber"
          icon={<span className="text-sm">🏆</span>}
          value={
            <>
              {stats.badgesCount}{' '}
              <span className="text-sm font-medium text-[var(--muted-warm)]">
                {t('intern.dashboard.stats.badges_earned', {
                  count: stats.badgesCount,
                }).replace(/^\d+\s*/, '')}
              </span>
            </>
          }
          subline={stats.badgesSubline}
        />
      </div>
      <div data-clicky-target="onboarding, deadline, days left, timer, countdown" data-clicky-hint={t('clicky.hint.stats.onboarding')}>
        <StatCard
          label={t('intern.dashboard.stats.onboarding_label')}
          tone="emerald"
          icon={<span className="text-sm">⌛</span>}
          value={stats.daysUntilDeadline}
          valueSuffix={t('intern.dashboard.stats.onboarding_days_left', {
            count: stats.daysUntilDeadline,
          }).replace(/^\d+\s*/, '')}
          subline={stats.deadlineSubline}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Active scenario hero — warm wrapper + simplified Direction A preview
// ───────────────────────────────────────────────────────────────────────

interface HeroProps {
  current: PathStep | null;
  currentTitle: string;
  starting: boolean;
  doneCount: number;
  totalSteps: number;
  onContinue: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function ActiveScenarioHero({
  current,
  currentTitle,
  starting,
  doneCount,
  totalSteps,
  onContinue,
  t,
}: HeroProps) {
  const currentIndex = current
    ? LEARNING_PATH.findIndex((s) => s.id === current.id) + 1
    : doneCount;
  const rewardXp = 50; // TODO: derive from quest config when backend exposes it
  return (
    <WarmCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-coral-600">
            {t('intern.dashboard.hero.today_quest_label')}
          </div>
          <div className="mt-0.5 truncate text-lg font-extrabold text-[var(--ink-warm)]">
            {current
              ? t('intern.dashboard.hero.step_of', {
                  title: currentTitle,
                  current: currentIndex,
                  total: totalSteps,
                })
              : t('intern.dashboard.hero.all_done')}
          </div>
        </div>
        {current?.scenarioId && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              {t('intern.dashboard.hero.xp_pill', { xp: rewardXp })}
            </span>
            <button
              type="button"
              onClick={onContinue}
              disabled={starting}
              data-clicky-target="continue, start, kyc, next, simulator, run"
              data-clicky-hint={`This opens "${currentTitle}" in the simulator.`}
              className="rounded-full bg-[var(--ink-warm)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting
                ? t('intern.dashboard.starting')
                : t('intern.dashboard.hero.continue_short')}
            </button>
          </div>
        )}
      </div>

      <SimPreviewInner
        currentTitle={currentTitle}
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        t={t}
      />
    </WarmCard>
  );
}

// Direction A "preview" — visually matches mockup 06 lines 309–374 but
// renders no live form. Tells the intern "here's where you are in the sim."
// The real KYC runner is at /simulator/kyc/:runId.
function SimPreviewInner({
  currentTitle,
  currentIndex,
  totalSteps,
  t,
}: {
  currentTitle: string;
  currentIndex: number;
  totalSteps: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="bg-[#FAFAFA] px-6 py-6 font-tech">
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
        {/* Chrome bar */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 text-[12px] text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
            </div>
            <span className="text-zinc-300">|</span>
            <span className="font-mono-tech">ABC ▸ KYC ▸ Sanctions</span>
          </div>
          <span className="font-mono-tech">
            SYN-849-2207 · step {currentIndex}/{totalSteps}
          </span>
        </div>
        {/* Body: simplified preview, not a live form */}
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight text-zinc-900">
            {currentTitle}
          </h3>
          <p className="mt-1 text-[13px] text-zinc-600">
            {t('intern.dashboard.hero.synthetic_badge')}
          </p>
          <ol className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const n = i + 1;
              const isDone = n < currentIndex;
              const isCurrent = n === currentIndex;
              return (
                <li
                  key={n}
                  className={`rounded-md border px-3 py-2 text-center text-xs font-mono-tech ${
                    isCurrent
                      ? 'border-mentora-600 bg-mentora-50 text-mentora-600'
                      : isDone
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-200 bg-white text-zinc-400'
                  }`}
                >
                  {isDone ? '✓' : n}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Scenarios list
// ───────────────────────────────────────────────────────────────────────

function ScenariosCard({
  path,
  t,
}: {
  path: readonly PathStep[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <WarmCard className="p-0">
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
            {t('intern.dashboard.scenarios.section_label')}
          </div>
          <div className="text-lg font-extrabold text-[var(--ink-warm)]">
            {t('intern.dashboard.scenarios.section_title')}
          </div>
        </div>
        <Link
          to="/simulator"
          className="text-sm font-semibold text-mentora-600 hover:underline"
          data-clicky-target="all, scenarios, browse, catalog, simulator"
          data-clicky-hint="Browse every scenario, including ones outside your assigned path."
        >
          {t('intern.dashboard.scenarios.view_all')}
        </Link>
      </div>
      <div className="border-t border-zinc-100">
        <div className="grid grid-cols-[1.4fr_0.9fr_1fr_0.7fr_0.4fr] gap-3 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          <span>{t('intern.dashboard.scenarios.col_scenario')}</span>
          <span>{t('intern.dashboard.scenarios.col_module')}</span>
          <span>{t('intern.dashboard.scenarios.col_progress')}</span>
          <span>{t('intern.dashboard.scenarios.col_status')}</span>
          <span />
        </div>
        {path.map((step, idx) => {
          const status = mapState(step.state, idx, path);
          const visual = SCENARIO_VISUAL[step.id] ?? {
            icon: '📘',
            tone: 'mentora' as ScenarioIconTone,
          };
          const progressPct = progressFor(status);
          const stepsLabel =
            status === 'locked'
              ? t('intern.dashboard.scenarios.locked_reason')
              : t('intern.dashboard.scenarios.steps_progress', {
                  done: status === 'mastered' ? 4 : status === 'in_progress' ? 2 : 0,
                  total: 4,
                });
          const title = t(step.titleKey);
          return (
            <div
              key={step.id}
              data-clicky-target={`${step.id}, ${title.toLowerCase()}, scenario, ${status}`}
              data-clicky-hint={
                status === 'locked'
                  ? `"${title}" — ${t('intern.dashboard.scenarios.locked_reason')}.`
                  : status === 'mastered'
                    ? `"${title}" — already mastered. Open it again to review.`
                    : status === 'in_progress'
                      ? `"${title}" — your active scenario. Continue from here.`
                      : `"${title}" — ${t('clicky.hint.scenario_row')}`
              }
            >
              <ScenarioRow
                icon={<span aria-hidden="true">{visual.icon}</span>}
                iconTone={visual.tone}
                title={title}
                steps={stepsLabel}
                module={t(step.moduleKey)}
                progressPct={progressPct}
                status={status}
              />
            </div>
          );
        })}
      </div>
    </WarmCard>
  );
}

function mapState(
  state: PathStep['state'],
  idx: number,
  all: readonly PathStep[],
): ScenarioStatus {
  if (state === 'done') return 'mastered';
  if (state === 'current') return 'in_progress';
  // First locked step after current → "not_started" (you can try it);
  // anything later than that → "locked" (hard gate).
  const firstLockedIdx = all.findIndex((s) => s.state === 'locked');
  return idx === firstLockedIdx ? 'not_started' : 'locked';
}

function progressFor(status: ScenarioStatus): number {
  switch (status) {
    case 'mastered':
      return 100;
    case 'in_progress':
      // TODO: derive from current run state (simApi.getRun) when wired.
      return 50;
    default:
      return 0;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Right rail — tasks, activity, cohort
// ───────────────────────────────────────────────────────────────────────

function RightRail({
  t,
  internData,
  activityData,
  loading,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  internData: InternMe | null;
  activityData: InternActivityEntry[] | null;
  loading: boolean;
}) {
  return (
    <>
      <TasksCard t={t} />
      <ActivityCard t={t} activityData={activityData} loading={loading} />
      <CohortCard t={t} internData={internData} loading={loading} />
    </>
  );
}

interface SeedTask {
  key: string;
  titleKey: string;
  sublineKey: string;
  xp: number;
  xpTone: XpTone;
}

// TODO: tasksApi — backend doesn't expose a per-intern task list yet.
// These mirror the mockup; the real ones will be derived from the active
// scenario state + assigned mentor messages + outstanding SOP reads.
const SEED_TASKS: readonly SeedTask[] = [
  {
    key: 'kyc-step-2',
    titleKey: 'intern.dashboard.tasks.kyc_step_2',
    sublineKey: 'intern.dashboard.tasks.kyc_step_2_sub',
    xp: 15,
    xpTone: 'mentora',
  },
  {
    key: 'aml-intro',
    titleKey: 'intern.dashboard.tasks.aml_intro',
    sublineKey: 'intern.dashboard.tasks.aml_intro_sub',
    xp: 5,
    xpTone: 'amber',
  },
  {
    key: 'reply-mentor',
    titleKey: 'intern.dashboard.tasks.reply_mentor',
    sublineKey: 'intern.dashboard.tasks.reply_mentor_sub',
    xp: 10,
    xpTone: 'emerald',
  },
];

function TasksCard({ t }: { t: (k: string, o?: Record<string, unknown>) => string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const remaining = SEED_TASKS.filter((task) => !done[task.key]).length;
  const dueCount = 2;
  return (
    <WarmCard small className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-coral-600">
            {t('intern.dashboard.tasks.section_label')}
          </div>
          <div className="text-lg font-extrabold text-[var(--ink-warm)]">
            {t('intern.dashboard.tasks.section_title_count', { count: remaining })}
          </div>
        </div>
        {dueCount > 0 && remaining > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
            {t('intern.dashboard.tasks.due_pill', { count: dueCount })}
          </span>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {SEED_TASKS.map((task) => {
          const title = t(task.titleKey);
          return (
            <div
              key={task.key}
              data-clicky-target={`${task.key}, task, todo, ${title.toLowerCase()}`}
              data-clicky-hint={`Today's task: "${title}". ${t('clicky.hint.task')}`}
            >
              <TaskRow
                title={title}
                subline={t(task.sublineKey)}
                xpAmount={task.xp}
                xpTone={task.xpTone}
                done={!!done[task.key]}
                onToggle={() =>
                  setDone((prev) => ({ ...prev, [task.key]: !prev[task.key] }))
                }
              />
            </div>
          );
        })}
      </ul>
    </WarmCard>
  );
}

interface ActivityEntry {
  id: string;
  variant: 'mentor_comment' | 'clicky_tip' | 'peer_finished' | 'hr_assigned';
  actorName: string;
  avatarTone: AvatarTone;
  initials: string;
  /** Minutes ago. */
  minutesAgo: number;
}

// TODO: hrApi.streamEvents() filtered to "events for me" once the backend
// adds per-user filtering. These mirror the mockup.
const SEED_ACTIVITY: readonly ActivityEntry[] = [
  {
    id: 'oh-comment',
    variant: 'mentor_comment',
    actorName: 'Oscar Holloway',
    avatarTone: 'sky',
    initials: 'OH',
    minutesAgo: 10,
  },
  {
    id: 'clicky-tip',
    variant: 'clicky_tip',
    actorName: 'Clicky',
    avatarTone: 'rose',
    initials: '✦',
    minutesAgo: 25,
  },
  {
    id: 'dk-finished',
    variant: 'peer_finished',
    actorName: 'Dilshoda K.',
    avatarTone: 'em',
    initials: 'DK',
    minutesAgo: 60,
  },
  {
    id: 'hr-assigned',
    variant: 'hr_assigned',
    actorName: 'Nilufar (HR)',
    avatarTone: 'rose',
    initials: 'HR',
    minutesAgo: 120,
  },
];

function mapBackendActivity(
  entries: InternActivityEntry[],
): readonly ActivityEntry[] {
  // Cycle through avatar tones so consecutive rows don't blob into one colour.
  const tones: AvatarTone[] = ['sky', 'em', 'rose', 'orng', 'viol'];
  return entries.map((entry, idx) => {
    const variant: ActivityEntry['variant'] =
      entry.variant === 'mentor_assigned'
        ? 'hr_assigned'
        : entry.variant === 'quest_completed'
          ? 'peer_finished'
          : 'mentor_comment';
    const minutesAgo = Math.max(
      0,
      Math.round((Date.now() - new Date(entry.createdAt).getTime()) / 60_000),
    );
    return {
      id: entry.id,
      variant,
      actorName: entry.actorName || 'Mentora',
      avatarTone: tones[idx % tones.length]!,
      initials: initialsFromName(entry.actorName),
      minutesAgo,
    };
  });
}

function initialsFromName(name: string): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function ActivityCard({
  t,
  activityData,
  loading,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  activityData: InternActivityEntry[] | null;
  loading: boolean;
}) {
  const entries: readonly ActivityEntry[] =
    activityData && activityData.length > 0
      ? mapBackendActivity(activityData)
      : SEED_ACTIVITY;
  return (
    <WarmCard small className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
            {t('intern.dashboard.activity.section_label')}
          </div>
          <div className="text-lg font-extrabold text-[var(--ink-warm)]">
            {t('intern.dashboard.activity.section_title')}
          </div>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-mentora-600 hover:underline"
        >
          {t('intern.dashboard.activity.view_all')}
        </button>
      </div>
      {loading ? (
        <ul className="mt-4 space-y-3.5">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-10 w-full animate-pulse rounded-lg bg-zinc-100" />
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {entries.map((entry) => (
            <ActivityRow
              key={entry.id}
              leading={
                entry.variant === 'clicky_tip' ? (
                  <ClickyAvatar />
                ) : (
                  <span
                    className={`av-${entry.avatarTone} grid h-9 w-9 place-items-center rounded-full text-xs font-bold`}
                  >
                    {entry.initials}
                  </span>
                )
              }
              timestamp={formatAgo(entry.minutesAgo, t)}
            >
              {renderActivitySentence(entry, t)}
            </ActivityRow>
          ))}
        </ul>
      )}
    </WarmCard>
  );
}

function ClickyAvatar() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-coral-600 to-[#ff9670]">
      <MentoraMark className="h-4 w-4 text-white" />
    </span>
  );
}

function renderActivitySentence(
  entry: ActivityEntry,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  const ink2 = 'text-[var(--ink-warm-2)]';
  if (entry.variant === 'mentor_comment') {
    return (
      <>
        <p>
          <span className="font-bold text-[var(--ink-warm)]">{entry.actorName}</span>{' '}
          <span className={ink2}>
            {t('intern.dashboard.activity.mentor_comment_lead', {
              name: entry.actorName,
            }).replace(entry.actorName, '')}
          </span>{' '}
          <span className="font-bold text-mentora-600">
            {t('intern.dashboard.activity.mentor_comment_object')}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted-warm)]">
          {t('intern.dashboard.activity.mentor_comment_excerpt')}
        </p>
      </>
    );
  }
  if (entry.variant === 'clicky_tip') {
    return (
      <p>
        <span className="font-bold text-[var(--ink-warm)]">Clicky</span>{' '}
        <span className={ink2}>
          {t('intern.dashboard.activity.clicky_tip_lead').replace('Clicky', '')}
        </span>{' '}
        <span className="font-bold text-[var(--ink-warm)]">
          {t('intern.dashboard.activity.clicky_tip_name')}
        </span>
      </p>
    );
  }
  if (entry.variant === 'peer_finished') {
    return (
      <p>
        <span className="font-bold text-[var(--ink-warm)]">{entry.actorName}</span>{' '}
        <span className={ink2}>
          {t('intern.dashboard.activity.peer_finished_lead', {
            name: entry.actorName,
          }).replace(entry.actorName, '')}
        </span>{' '}
        <span className="font-bold text-emerald-600">
          {t('intern.dashboard.activity.peer_finished_object')}
        </span>
      </p>
    );
  }
  // hr_assigned
  return (
    <p>
      <span className="font-bold text-[var(--ink-warm)]">{entry.actorName}</span>{' '}
      <span className={ink2}>
        {t('intern.dashboard.activity.hr_assigned_lead', {
          name: entry.actorName,
        }).replace(entry.actorName, '')}
      </span>{' '}
      <span className="font-bold text-[var(--ink-warm)]">
        {t('intern.dashboard.activity.hr_assigned_object')}
      </span>{' '}
      <span className={ink2}>
        {t('intern.dashboard.activity.hr_assigned_tail')}
      </span>
    </p>
  );
}

function formatAgo(
  minutes: number,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (minutes < 60) return t('intern.dashboard.activity.minutes_ago', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours === 1) return t('intern.dashboard.activity.hour_ago');
  return t('intern.dashboard.activity.hours_ago', { count: hours });
}

interface CohortEntry {
  initials: string;
  name: string;
  level: number;
  tone: AvatarTone;
}

// TODO: cohortApi — no clean intern-side "my cohort" endpoint today.
// Hardcoded to give the dashboard a realistic feel.
const SEED_COHORT: readonly CohortEntry[] = [
  { initials: 'DK', name: 'Dilshoda', level: 5, tone: 'em' },
  { initials: 'AT', name: 'Aziz', level: 3, tone: 'orng' },
  { initials: 'JK', name: 'Jasur', level: 4, tone: 'sky' },
  { initials: 'ZN', name: 'Zarina', level: 4, tone: 'viol' },
  { initials: 'LK', name: 'Laylo', level: 2, tone: 'rose' },
];

function mapBackendCohort(members: InternMe['cohort']): readonly CohortEntry[] {
  const tones: AvatarTone[] = ['em', 'orng', 'sky', 'viol', 'rose'];
  return members.slice(0, 5).map((m, idx) => {
    const firstName = (m.fullName ?? '').split(/\s+/)[0] ?? 'Intern';
    return {
      initials: m.initials,
      name: firstName,
      level: m.level,
      tone: tones[idx % tones.length]!,
    };
  });
}

function CohortCard({
  t,
  internData,
  loading,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  internData: InternMe | null;
  loading: boolean;
}) {
  const cohort: readonly CohortEntry[] =
    internData && internData.cohort.length > 0
      ? mapBackendCohort(internData.cohort)
      : SEED_COHORT;
  return (
    <WarmCard small className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
            {t('intern.dashboard.cohort.section_label')}
          </div>
          <div className="text-lg font-extrabold text-[var(--ink-warm)]">
            {t('intern.dashboard.cohort.section_count', {
              count: cohort.length,
            })}
          </div>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-mentora-600 hover:underline"
        >
          {t('intern.dashboard.cohort.view_all')}
        </button>
      </div>
      {loading ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-2xl bg-zinc-100"
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {cohort.map((c, idx) => (
            <div
              key={`${c.initials}-${idx}`}
              data-clicky-target={`${c.name.toLowerCase()}, ${c.initials.toLowerCase()}, cohort, peer, intern`}
              data-clicky-hint={`${c.name} — fellow intern, level ${c.level}.`}
            >
              <CohortTile
                initials={c.initials}
                name={c.name}
                level={c.level}
                tone={c.tone}
              />
            </div>
          ))}
          <button
            type="button"
            data-clicky-target="invite, add, cohort, new, peer"
            data-clicky-hint="Invite another intern to your cohort."
            className="grid place-items-center rounded-2xl border-2 border-dashed border-zinc-200 p-3 text-center text-xs text-[var(--muted-warm)] transition hover:border-coral-600 hover:text-coral-600"
          >
            {t('intern.dashboard.cohort.invite')}
          </button>
        </div>
      )}
    </WarmCard>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Error banner — used for sim-start failures and game-profile load failures.
// ───────────────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      {message}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Date helpers
// ───────────────────────────────────────────────────────────────────────

function localeToBcp47(l: Locale): string {
  switch (l) {
    case 'uz':
      return 'uz-UZ';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
}

function formatShortDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDateRange(locale: Locale): string {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 4);
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
