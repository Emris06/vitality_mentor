import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LocalePicker } from '../../components/LocalePicker';
import { gameApi, GameHttpError } from '../../lib/api';
import { XPBars } from './XPBars';
import { BadgeWall } from './BadgeWall';
import { QuestCard } from './QuestCard';
import { StreakRing } from './StreakRing';
import { DeadlineRing } from './DeadlineRing';
import { Leaderboard } from './Leaderboard';
import type { GameProfile } from './types';

const FALLBACK_PROFILE: GameProfile = {
  xpBySkill: {},
  badges: [],
  streak: { current: 0, longest: 0 },
  todayQuest: null,
};

/**
 * `/me` profile page. Loads the gamification snapshot on mount and renders a
 * single-column-on-mobile, two-column-on-desktop layout: XP + quest on the
 * left, badges on the right, leaderboard at the bottom.
 */
export function ProfilePage() {
  const { t } = useTranslation();
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

  // Synthetic initials for the avatar circle. Until the backend exposes the
  // current user's name we fall back to the locale-appropriate "Me" glyph.
  const initials = 'AI';

  return (
    <main className="min-h-full bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-9 w-9 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
              aria-label={t('game.back')}
            >
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
            </Link>
            <div
              className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white font-bold"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-ink-900">
                {t('game.profile_title')}
              </span>
              <span className="text-xs text-ink-500">{t('game.subtitle')}</span>
            </div>
          </div>
          <LocalePicker />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {error && (
          <div
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {t('game.errors.load_profile')}
          </div>
        )}

        {/* Hero strip: total XP + streak ring + deadline ring */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid items-center gap-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm md:grid-cols-[1.4fr_1fr_1fr]"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">{t('game.total_xp')}</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-ink-900">
              {totalXp.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              {loading ? '…' : Object.keys(view.xpBySkill).length + ' skills'}
            </p>
          </div>
          <div className="flex justify-center">
            <StreakRing current={view.streak.current} longest={view.streak.longest} />
          </div>
          <div className="flex justify-center">
            <DeadlineRing deadline={view.onboardingDeadline} />
          </div>
        </motion.div>

        {/* Two-column grid: stacks on mobile */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <XPBars xpBySkill={view.xpBySkill} />
            <QuestCard quest={view.todayQuest} />
          </div>
          <div className="space-y-6">
            <BadgeWall badges={view.badges} />
          </div>
        </div>

        <div className="mt-6">
          <Leaderboard />
        </div>
      </section>
    </main>
  );
}
