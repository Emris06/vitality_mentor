import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { gameApi, GameHttpError } from '../../lib/api';
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

const FALLBACK_PROFILE: GameProfile = {
  xpBySkill: {},
  badges: [],
  streak: { current: 0, longest: 0 },
  todayQuest: null,
};

// ──────────────────────────────────────────────────────────────────────────
// `/me` profile page — warm theme (Phase E).
//
// Behavior preserved bit-identical:
//   - gameApi.me<GameProfile>() on mount with cancel-on-unmount guard
//   - Non-intern roles redirect to their role's home (intern-only by design)
//   - Leaderboard loads its own data; we just pass currentUserId for highlight
// ──────────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const view = profile ?? FALLBACK_PROFILE;
  const totalXp = useMemo(
    () => Object.values(view.xpBySkill).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [view.xpBySkill],
  );

  // Role-gated: profile is intern-only by design. Non-interns get redirected
  // to their role home so the sidebar's "Profile" slot still has a destination.
  if (authProfile?.role !== 'intern') {
    return <Navigate to={homeRouteFor(authProfile?.role ?? null)} replace />;
  }

  const userName = authProfile?.fullName ?? 'Team Member';
  const firstName = userName.split(/\s+/)[0] ?? userName;

  return (
    <InternShell
      enableClicky
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
                {totalXp.toLocaleString()}
              </p>
              <p className="mt-2 font-mono-tech text-xs text-[var(--muted-warm)]">
                {loading ? '…' : `${Object.keys(view.xpBySkill).length} skills`}
              </p>
            </div>
            <div className="flex justify-center">
              <StreakRing current={view.streak.current} longest={view.streak.longest} />
            </div>
            <div className="flex justify-center">
              <DeadlineRing deadline={view.onboardingDeadline ?? undefined} />
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
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <WarmCard className="p-5">
          <QuestCard quest={view.todayQuest} />
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
