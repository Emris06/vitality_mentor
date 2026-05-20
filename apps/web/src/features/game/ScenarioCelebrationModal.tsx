import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  score: number;
  rewardXp?: number;
  newBadges?: string[];
  onClose: () => void;
}

export function ScenarioCelebrationModal({
  open,
  score,
  rewardXp,
  newBadges = [],
  onClose,
}: Props) {
  const { t } = useTranslation();

  let scoreClass = 'text-emerald-600';
  if (score < 60) scoreClass = 'text-rose-600';
  else if (score < 85) scoreClass = 'text-amber-600';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card-warm ring-1 ring-zinc-200"
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
          >
            <p
              id="celebration-title"
              className="text-[11px] font-bold uppercase tracking-wider text-mentora-600"
            >
              {t('game.celebration.title')}
            </p>
            <p className={`mt-2 font-mono-tech text-5xl font-bold ${scoreClass}`}>{score}</p>
            <p className="mt-1 text-sm text-zinc-600">{t('sim.run.score_of_100')}</p>
            {rewardXp != null && rewardXp > 0 && (
              <p className="mt-3 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                {t('game.celebration.xp_earned', { xp: rewardXp })}
              </p>
            )}
            {newBadges.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-zinc-700">
                {newBadges.map((id) => (
                  <li key={id}>
                    {t(`badges.${id}.name`, { defaultValue: id })}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-mentora-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mentora-700"
            >
              {t('game.celebration.continue')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
