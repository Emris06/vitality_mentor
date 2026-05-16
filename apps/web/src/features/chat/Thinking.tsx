import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const DOT_TRANSITION = {
  duration: 0.9,
  repeat: Infinity,
  ease: 'easeInOut' as const,
};

export function Thinking() {
  const { t } = useTranslation();
  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600 shadow-sm"
      role="status"
      aria-label={t('chat.thinking')}
    >
      <span className="sr-only">{t('chat.thinking')}</span>
      <span aria-hidden="true" className="flex items-end gap-1">
        {[0, 0.15, 0.3].map((delay) => (
          <motion.span
            key={delay}
            className="block h-1.5 w-1.5 rounded-full bg-brand-600"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ ...DOT_TRANSITION, delay }}
          />
        ))}
      </span>
    </div>
  );
}
