import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface DeadlineRingProps {
  /** ISO date of the onboarding deadline. Optional — falls back to stub. */
  deadline?: string;
}

const SIZE = 140;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const FULL_WINDOW_DAYS = 90;
// TODO: wire the real deadline from the HR `/me` payload once the backend
// returns `onboardingDeadline`. For now we hardcode a demo target so
// the ring renders meaningfully against today's date.
const STUB_DEADLINE = '2026-08-31';

function diffInDays(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((a - b) / MS_PER_DAY);
}

/**
 * Mirror of StreakRing showing days-left on the onboarding deadline. Color
 * shifts emerald → amber → rose as the runway shrinks.
 */
export function DeadlineRing({ deadline }: DeadlineRingProps) {
  const { t } = useTranslation();

  const view = useMemo(() => {
    const iso = deadline ?? STUB_DEADLINE;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return { days: 0, valid: false, overdue: false };
    }
    const days = diffInDays(parsed, new Date());
    return { days, valid: true, overdue: days < 0 };
  }, [deadline]);

  if (!view.valid) {
    return (
      <div className="flex flex-col items-center text-ink-400" aria-hidden="true">
        <div
          className="grid place-items-center rounded-full bg-ink-100"
          style={{ width: SIZE, height: SIZE }}
        >
          —
        </div>
      </div>
    );
  }

  const safeDays = Math.max(0, view.days);
  const pct = Math.min(1, safeDays / FULL_WINDOW_DAYS);
  const dashOffset = CIRCUMFERENCE * (1 - pct);

  const tone =
    view.overdue || safeDays === 0
      ? { stroke: '#e11d48', text: 'text-rose-600' }
      : safeDays <= 7
        ? { stroke: '#e11d48', text: 'text-rose-600' }
        : safeDays <= 14
          ? { stroke: '#d97706', text: 'text-amber-600' }
          : { stroke: '#059669', text: 'text-emerald-600' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="flex flex-col items-center"
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
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
            stroke={tone.stroke}
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
          {view.overdue ? (
            <span className={`text-sm font-semibold ${tone.text}`}>
              {t('game.deadline.overdue')}
            </span>
          ) : safeDays === 0 ? (
            <span className={`text-sm font-semibold ${tone.text}`}>
              {t('game.deadline.due_today')}
            </span>
          ) : (
            <>
              <span className={`text-2xl font-bold tabular-nums ${tone.text}`}>{safeDays}</span>
              <span className="text-[11px] uppercase tracking-wide text-ink-500">
                {t('game.deadline.days_left', { count: safeDays })}
              </span>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-500">
        {t('game.streak.deadline_left')}
      </p>
    </motion.div>
  );
}
