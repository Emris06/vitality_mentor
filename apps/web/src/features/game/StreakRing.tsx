import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface StreakRingProps {
  current: number;
  longest: number;
}

const SIZE = 140;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Full ring at 30 days; longer streaks stay full. */
const FULL_DAYS = 30;

/**
 * Circular streak indicator. The ring fills based on `current / FULL_DAYS`.
 * Streaks of ≥7 days pulse gently to celebrate momentum.
 */
export function StreakRing({ current, longest }: StreakRingProps) {
  const { t } = useTranslation();
  const safeCurrent = Math.max(0, current);
  const pct = Math.min(1, safeCurrent / FULL_DAYS);
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const isHot = safeCurrent >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center"
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
          className={isHot ? 'animate-pulse' : undefined}
        >
          <defs>
            <linearGradient id="streakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#f1f5f9"
            strokeWidth={STROKE}
            fill="none"
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="url(#streakGradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl" aria-hidden="true">
            🔥
          </span>
          <span className="text-2xl font-bold tabular-nums text-ink-900">{safeCurrent}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-500">
        {t('game.streak.title')}
      </p>
      <p className="text-[11px] text-ink-500">{t('game.streak.longest', { count: longest })}</p>
    </motion.div>
  );
}
