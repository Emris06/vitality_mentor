import { useTranslation } from 'react-i18next';

interface Props {
  enabled: boolean;
  supported: boolean;
  onToggle: () => void;
}

export function VoiceModeToggle({ enabled, supported, onToggle }: Props) {
  const { t } = useTranslation();

  const label = enabled ? t('chat.voice.mode_on') : t('chat.voice.mode_off');
  const tooltip = !supported ? t('chat.voice.unsupported') : label;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      aria-pressed={enabled}
      title={tooltip}
      data-clicky-target="voice, mode, read, tts, speak, autoSpeak"
      data-clicky-hint={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus:ring-2 focus:ring-mentora-600/30 ring-1 ${
        !supported
          ? 'cursor-not-allowed bg-zinc-50 text-zinc-400 ring-zinc-200'
          : enabled
            ? 'bg-mentora-600 text-white ring-mentora-600 hover:bg-mentora-700'
            : 'bg-white text-[var(--ink-warm-2)] ring-zinc-200 hover:bg-mentora-50 hover:text-mentora-700'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
