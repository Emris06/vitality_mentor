import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { UseClickyAgent } from './useClickyAgent';

interface Props {
  agent: UseClickyAgent;
  hotkey?: string;
  /** Called whenever the push-to-talk recording state changes. */
  onPttChange?: (ptt: boolean) => void;
}

// Bottom-center recording / thinking pill.
// Visible only while the user is holding the hotkey or the agent is mid-response.
// The PTT state is also forwarded to the shell so the topbar can show the
// `.ptt-hint.live` indicator.
export function ClickyVoiceOverlay({ agent, hotkey = '`', onPttChange }: Props) {
  const visible = agent.recording || agent.thinking;

  useEffect(() => {
    onPttChange?.(agent.recording);
  }, [agent.recording, onPttChange]);

  return (
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
            style={{
              display: 'flex',
              minWidth: '280px',
              maxWidth: '420px',
              alignItems: 'center',
              gap: '12px',
              borderRadius: '999px',
              padding: '10px 18px',
              background: agent.thinking ? 'rgba(240,240,255,0.96)' : 'rgba(236,240,255,0.96)',
              border: `1px solid ${agent.thinking ? 'rgba(32,70,255,0.30)' : 'rgba(32,70,255,0.22)'}`,
              boxShadow: '0 8px 24px -8px rgba(32,70,255,0.25)',
              backdropFilter: 'blur(8px)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {agent.thinking ? <SpinnerDot /> : <MicLevel />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                margin: 0,
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--cobalt)',
              }}>
                {agent.thinking
                  ? 'Думаю…'
                  : `Слушаю — отпусти ${hotkey} чтобы отправить`}
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {agent.transcript || (agent.thinking ? 'Отправляю запрос…' : 'Говорите сейчас')}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MicLevel() {
  return (
    <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ position: 'relative', width: '12px', height: '12px' }}>
        <span style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%', background: 'rgba(32,70,255,0.4)',
          animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <span style={{
          position: 'relative', display: 'block',
          width: '12px', height: '12px', borderRadius: '50%',
          background: 'var(--cobalt)',
        }} />
      </span>
    </span>
  );
}

function SpinnerDot() {
  return (
    <span style={{
      width: '16px', height: '16px', flexShrink: 0,
      borderRadius: '50%',
      border: '2px solid var(--cobalt)',
      borderTopColor: 'transparent',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}
