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
      <>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('game.quests.today')}
        </h3>
        <p className="mt-3 text-sm text-[var(--muted-warm)]">{t('game.quests.empty')}</p>
      </>
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
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
            {t('game.quests.today')}
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-[var(--ink-warm)]">{name}</h3>
          {description && (
            <p className="mt-1 text-sm text-[var(--ink-warm-2)]">{description}</p>
          )}
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2.5 py-1 font-mono-tech text-[11px] font-bold tabular-nums ' +
            (completed
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-mentora-50 text-mentora-700')
          }
        >
          {t('game.quests.reward_xp', { xp: quest.rewardXp })}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--muted-warm)]">{t('game.quests.progress')}</span>
          {goal > 0 ? (
            <span className="font-mono-tech tabular-nums text-[var(--ink-warm)]">
              {done} / {goal}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className={
              'h-full rounded-full ' +
              (completed
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-mentora-600 to-mentora-400')
            }
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
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
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
  const first = goalEntries[0];
  if (!first) return { done: 0, goal: 0 };
  const [key, goalValue] = first;
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
