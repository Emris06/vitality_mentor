import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  listening: boolean;
  supported: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function MicButton({ listening, supported, disabled, onToggle }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const isDisabled = !supported || disabled;
  const label = listening
    ? t('chat.voice.stop_listening')
    : t('chat.voice.start_listening');

  // Styles per state.
  const stateClass = !supported
    ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
    : listening
      ? 'bg-brand-600 text-white shadow'
      : 'bg-brand-50 text-brand-600 hover:bg-brand-100';

  return (
    <button
      type="button"
      aria-label={!supported ? t('chat.voice.unsupported') : label}
      aria-pressed={listening}
      title={!supported ? t('chat.voice.unsupported') : label}
      disabled={isDisabled}
      onClick={onToggle}
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors outline-none focus:ring-2 focus:ring-brand-100 ${stateClass}`}
    >
      {listening && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-brand-600"
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className="relative grid place-items-center">
        {listening ? (
          // Stop square.
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        ) : (
          // Mic icon.
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
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
            <path d="M8 21h8" />
          </svg>
        )}
      </span>
    </button>
  );
}
