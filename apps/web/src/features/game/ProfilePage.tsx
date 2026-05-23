import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { gameApi, GameHttpError, internApi } from '../../lib/api';
import type { InternMe, InternRecentRun } from '../../lib/api';
import { XPBars } from './XPBars';
import { BadgeWall } from './BadgeWall';
import { QuestCard } from './QuestCard';
import { StreakRing } from './StreakRing';
import { DeadlineRing } from './DeadlineRing';
import { Leaderboard } from './Leaderboard';
import type { GameProfile } from './types';
import { useAuth } from '../auth/AuthProvider';
import { homeRouteFor } from '../auth/types';
import { InternShell } from '../workspace/InternShell';
import { buildMentoraNav } from '../workspace/mentoraNav';
import { WarmCard } from '../../components/warm/WarmCard';

/* -------------------------------------------------------------------------- */
/* Seed / fallback data — used when the API is unreachable                    */
/* -------------------------------------------------------------------------- */

const _now = Date.now();

const FALLBACK_PROFILE: GameProfile = {
  xpBySkill: { kyc: 230, compliance: 90, research: 40 },
  badges: [
    {
      id: 'first_kyc',
      nameKey: 'game.badges.first_kyc.name',
      descriptionKey: 'game.badges.first_kyc.description',
      icon: '🛡️',
      earnedAt: '2026-05-20T10:00:00Z',
    },
  ],
  streak: { current: 5, longest: 7, lastActiveDate: new Date(_now - 86_400_000).toISOString() },
  todayQuest: {
    id: 'daily_chat_3',
    kind: 'daily',
    nameKey: 'quests.daily_chat_3.name',
    descriptionKey: 'quests.daily_chat_3.desc',
    goal: { chatSolved: 3 },
    progress: { chatSolved: 1 },
    rewardXp: 8,
  },
};

const FALLBACK_INTERN_ME: InternMe = {
  profile: { id: '', fullName: '', role: 'intern', avatarUrl: null },
  onboarding: {
    modulesCompleted: 3,
    modulesTotal: 8,
    deadline: '2026-08-31',
    assignedMentorName: 'Sardor Rakhimov',
  },
  recentRuns: [
    { id: 'seed-r1', scenarioId: 'kyc', score: 87, status: 'scored', createdAt: new Date(_now - 2 * 3_600_000).toISOString() },
    { id: 'seed-r2', scenarioId: 'open-account', score: 92, status: 'scored', createdAt: new Date(_now - 26 * 3_600_000).toISOString() },
    { id: 'seed-r3', scenarioId: 'kyc', score: 74, status: 'scored', createdAt: new Date(_now - 3 * 86_400_000).toISOString() },
  ],
  cohort: [],
};

const SCENARIO_LABELS: Record<string, string> = {
  kyc: 'KYC Verification',
  'open-account': 'Open Account',
  deposit: 'Deposit',
  transfer: 'Transfer',
};

const LEVEL_XP = 600;

/* -------------------------------------------------------------------------- */
/* Page component                                                              */
/* -------------------------------------------------------------------------- */

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [internMe, setInternMe] = useState<InternMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Primary gamification data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await gameApi.me<GameProfile>();
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof GameHttpError) setError(err.message);
        else setError('load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Onboarding + recent runs (separate endpoint, non-blocking)
  useEffect(() => {
    let cancelled = false;
    internApi
      .me()
      .then((data) => { if (!cancelled) setInternMe(data); })
      .catch(() => { if (!cancelled) setInternMe(FALLBACK_INTERN_ME); });
    return () => { cancelled = true; };
  }, []);

  const view = profile ?? FALLBACK_PROFILE;
  const intern = internMe ?? FALLBACK_INTERN_ME;

  const totalXp = useMemo(
    () => Object.values(view.xpBySkill).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [view.xpBySkill],
  );
  const level = Math.floor(totalXp / LEVEL_XP) + 1;

  // Role-gate: profile page is intern-only; other roles redirect to their home
  if (authProfile?.role !== 'intern') {
    return <Navigate to={homeRouteFor(authProfile?.role ?? null)} replace />;
  }

  const userName = authProfile?.fullName ?? 'Team Member';
  const firstName = userName.split(/\s+/)[0] ?? userName;

  const modulePct =
    intern.onboarding.modulesTotal > 0
      ? (intern.onboarding.modulesCompleted / intern.onboarding.modulesTotal) * 100
      : 0;

  return (
    <InternShell
      userName={userName}
      userRole={t('auth.role_intern_name')}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('game.profile_title')}
      navItems={buildMentoraNav(authProfile?.role ?? null)}
      rightPanel={
        <WarmCard className="p-5">
          <BadgeWall badges={view.badges} />
        </WarmCard>
      }
    >
      {error && (
        <div
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {t('game.errors.load_profile')}
        </div>
      )}

      {/* Hero row: total XP + streak ring + deadline ring */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <WarmCard className="p-6">
          <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
                {t('game.total_xp')}
              </p>
              <p className="mt-1 text-5xl font-extrabold tabular-nums text-[var(--ink-warm)]">
                {loading && !profile ? '…' : totalXp.toLocaleString()}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mentora-50 px-2.5 py-0.5 font-mono-tech text-xs font-bold text-mentora-700">
                  Level {level}
                </span>
                {intern.onboarding.assignedMentorName && (
                  <span className="font-mono-tech text-xs text-[var(--muted-warm)]">
                    Mentor: {intern.onboarding.assignedMentorName}
                  </span>
                )}
              </div>
              {/* Onboarding module progress */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between font-mono-tech text-[11px] text-[var(--muted-warm)]">
                  <span>Modules</span>
                  <span>
                    {intern.onboarding.modulesCompleted}/{intern.onboarding.modulesTotal}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <motion.div
                    className="h-full rounded-full bg-mentora-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${modulePct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <StreakRing current={view.streak.current} longest={view.streak.longest} />
            </div>
            <div className="flex justify-center">
              <DeadlineRing deadline={intern.onboarding.deadline ?? undefined} />
            </div>
          </div>
        </WarmCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <WarmCard className="p-5">
          <XPBars xpBySkill={view.xpBySkill} />
        </WarmCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <WarmCard className="p-5">
          <QuestCard quest={view.todayQuest} />
        </WarmCard>
      </motion.div>

      {/* Recent simulator runs */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.11 }}
      >
        <WarmCard className="p-5">
          <SimRunsCard runs={intern.recentRuns} />
        </WarmCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <WarmCard className="p-5">
          <Leaderboard currentUserId={authProfile?.id} />
        </WarmCard>
      </motion.div>
    </InternShell>
  );
}

/* -------------------------------------------------------------------------- */
/* SimRunsCard — recent simulator run history                                 */
/* -------------------------------------------------------------------------- */

function SimRunsCard({ runs }: { runs: InternRecentRun[] }) {
  const { t } = useTranslation();

  return (
    <>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
        {t('game.recent_runs.title')}
      </h3>

      {runs.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted-warm)]">{t('game.recent_runs.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {runs.map((run) => {
            const scoreCls =
              run.score === null
                ? 'bg-zinc-100 text-zinc-500'
                : run.score >= 85
                  ? 'bg-emerald-50 text-emerald-700'
                  : run.score >= 60
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-rose-50 text-rose-700';

            const scenarioLabel = SCENARIO_LABELS[run.scenarioId] ?? run.scenarioId;

            return (
              <li
                key={run.id}
                className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2"
              >
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 font-mono-tech text-xs font-bold tabular-nums ${scoreCls}`}
                >
                  {run.score !== null ? run.score : '—'}
                </span>
                <span className="flex-1 truncate text-sm font-semibold text-[var(--ink-warm)]">
                  {scenarioLabel}
                </span>
                <span className="shrink-0 font-mono-tech text-[11px] text-[var(--muted-warm)]">
                  {timeAgo(run.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
