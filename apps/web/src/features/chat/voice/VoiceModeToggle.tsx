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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-brand-100 ${
        !supported
          ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400'
          : enabled
            ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
            : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
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
