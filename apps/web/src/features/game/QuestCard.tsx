import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Quest } from './types';

interface QuestCardProps {
  quest: Quest | null;
}

/**
 * Today's quest. Shows title, description, a progress bar that infers
 * `done / goal` from the first matching numeric key pair, and a reward pill.
 * When `completedAt` is set we swap to a celebratory state.
 */
export function QuestCard({ quest }: QuestCardProps) {
  const { t } = useTranslation();

  if (!quest) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-900">{t('game.quests.today')}</h3>
        <p className="mt-3 text-sm text-ink-500">{t('game.quests.empty')}</p>
      </div>
    );
  }

  const completed = Boolean(quest.completedAt);
  const { done, goal } = summarizeProgress(quest);
  const pct = goal > 0 ? Math.min(100, (done / goal) * 100) : completed ? 100 : 0;
  const name = resolveOrFallback(t, `game.quests.${quest.id}.name`, quest.id);
  const description = resolveOrFallback(t, `game.quests.${quest.id}.description`, '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={
        'rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ' +
        (completed
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
          : 'border-ink-200 bg-white')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-500">
            {t('game.quests.today')}
          </p>
          <h3 className="mt-1 text-base font-semibold text-ink-900">{name}</h3>
          {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ' +
            (completed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-brand-50 text-brand-700')
          }
        >
          {t('game.quests.reward_xp', { xp: quest.rewardXp })}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">{t('game.quests.progress')}</span>
          {goal > 0 ? (
            <span className="tabular-nums text-ink-700">
              {done} / {goal}
            </span>
          ) : (
            // TODO: backend may ship richer goal shapes (multi-key, percent, …).
            // Render an em-dash placeholder until the shape is firmed up.
            <span className="text-ink-400">—</span>
          )}
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <motion.div
            className={'h-full rounded-full ' + (completed ? 'bg-emerald-500' : 'bg-brand-600')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {completed && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
        >
          <span aria-hidden="true">✓</span>
          {t('game.quests.completed')}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Pulls the first numeric goal/progress key pair. For unrecognized shapes we
 * return `{ done: 0, goal: 0 }`, which `QuestCard` renders as an em-dash.
 */
function summarizeProgress(quest: Quest): { done: number; goal: number } {
  const goalEntries = Object.entries(quest.goal).filter(
    ([, v]) => typeof v === 'number' && Number.isFinite(v),
  );
  if (goalEntries.length === 0) return { done: 0, goal: 0 };
  const [key, goalValue] = goalEntries[0];
  const rawProgress = quest.progress[key];
  const doneValue =
    typeof rawProgress === 'number' && Number.isFinite(rawProgress) ? rawProgress : 0;
  return { done: Math.max(0, doneValue), goal: Math.max(0, goalValue) };
}

function resolveOrFallback(
  t: (k: string) => string,
  key: string,
  fallback: string,
): string {
  const value = t(key);
  return value === key ? fallback : value;
}
