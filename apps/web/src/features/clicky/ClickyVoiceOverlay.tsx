import { AnimatePresence, motion } from 'framer-motion';
import type { UseClickyAgent } from './useClickyAgent';

interface Props {
  agent: UseClickyAgent;
  hotkey?: string;
}

// Bottom-center recording / thinking pill. Visible only while the user is
// holding the hotkey or the agent is mid-response.
export function ClickyVoiceOverlay({ agent, hotkey = '`' }: Props) {
  const visible = agent.recording || agent.thinking;
  return (
    <>
      {/* Always-on tiny hint chip in the bottom-left, so the intern knows
          the hotkey exists at all. Hidden on small screens. */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[70] hidden md:block">
        <div className="rounded-full border border-ink-200 bg-white/90 px-3 py-1.5 text-[11px] text-ink-600 shadow-card backdrop-blur">
          Hold{' '}
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-700">
            {hotkey}
          </kbd>{' '}
          and ask Clicky out loud
          {!agent.supported && (
            <span className="ml-2 rounded bg-warn-50 px-1.5 py-0.5 text-[10px] font-semibold text-warn-700">
              voice unsupported here
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            className="pointer-events-none fixed bottom-6 left-1/2 z-[75] -translate-x-1/2"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={`flex min-w-[280px] max-w-md items-center gap-3 rounded-full border px-4 py-2.5 shadow-pop backdrop-blur ${
                agent.thinking
                  ? 'border-fuchsia-200 bg-fuchsia-50/90'
                  : 'border-sky-200 bg-sky-50/90'
              }`}
            >
              {agent.thinking ? (
                <SpinnerDot tone="fuchsia" />
              ) : (
                <MicLevel />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] uppercase tracking-[0.12em] ${
                    agent.thinking ? 'text-fuchsia-700' : 'text-sky-700'
                  }`}
                >
                  {agent.thinking ? 'Thinking…' : `Listening — release ${hotkey} to send`}
                </p>
                <p className="truncate text-sm font-medium text-ink-800">
                  {agent.transcript || (agent.thinking ? 'Asking the agent…' : 'Speak now')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MicLevel() {
  return (
    <span className="flex h-7 w-7 items-center justify-center">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500/60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500" />
      </span>
    </span>
  );
}

function SpinnerDot({ tone }: { tone: 'fuchsia' }) {
  const color = tone === 'fuchsia' ? 'border-fuchsia-500' : 'border-sky-500';
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${color}`}
    />
  );
}
