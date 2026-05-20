import { useTranslation } from 'react-i18next';
import type { UseClickyAgent } from './useClickyAgent';

interface Props {
  agent: UseClickyAgent;
}

/** Mobile voice control when the desktop cursor follower is hidden. */
export function ClickyMobileFab({ agent }: Props) {
  const { t } = useTranslation();
  if (!agent.supported) return null;

  const label = agent.recording
    ? t('clicky.mobile.listening')
    : agent.thinking
      ? t('clicky.mobile.thinking')
      : t('clicky.mobile.hold_to_talk');

  return (
    <div className="fixed bottom-6 right-4 z-[85] md:hidden">
      <button
        type="button"
        onPointerDown={() => agent.toggle()}
        aria-pressed={agent.recording}
        aria-label={label}
        className={
          'grid h-14 w-14 place-items-center rounded-full shadow-lg ring-2 ring-white transition ' +
          (agent.recording
            ? 'bg-fuchsia-600 text-white'
            : 'bg-mentora-600 text-white hover:bg-mentora-700')
        }
      >
        <MicIcon className="h-6 w-6" />
      </button>
      <p className="mt-1 max-w-[72px] text-center text-[10px] font-semibold text-zinc-700">
        {label}
      </p>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}
