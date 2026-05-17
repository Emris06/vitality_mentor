import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ClickyTarget } from './ClickyProvider';

interface ClickyProps {
  cursor: { x: number; y: number };
  state: {
    enabled: boolean;
    target: ClickyTarget | null;
    agentBusy: boolean;
    speaking: boolean;
  };
}

// Clicky floats above-right of the real cursor. Eased follow gives it
// personality — a touch lazy, never jumpy. In target mode (agent took
// over) it moves faster so the response is visible.
const CURSOR_OFFSET = { x: 16, y: -22 };
const EASE_FOLLOW = 0.18;
const EASE_TARGET = 0.32;

export function Clicky({ cursor, state }: ClickyProps) {
  const [pos, setPos] = useState(() => ({
    x: cursor.x + CURSOR_OFFSET.x,
    y: cursor.y + CURSOR_OFFSET.y,
  }));
  const targetPos = useRef({ x: cursor.x + CURSOR_OFFSET.x, y: cursor.y + CURSOR_OFFSET.y });
  const inTargetMode = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (state.target) {
      targetPos.current = { x: state.target.x, y: state.target.y };
      inTargetMode.current = true;
    } else {
      targetPos.current = { x: cursor.x + CURSOR_OFFSET.x, y: cursor.y + CURSOR_OFFSET.y };
      inTargetMode.current = false;
    }
  }, [state.target, cursor.x, cursor.y]);

  useEffect(() => {
    function tick() {
      setPos((p) => {
        const dx = targetPos.current.x - p.x;
        const dy = targetPos.current.y - p.y;
        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
          return { x: targetPos.current.x, y: targetPos.current.y };
        }
        const ease = inTargetMode.current ? EASE_TARGET : EASE_FOLLOW;
        return { x: p.x + dx * ease, y: p.y + dy * ease };
      });
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const agentControlled = !!state.target;
  const tone = state.agentBusy ? 'busy' : agentControlled ? 'answer' : 'idle';

  const haloClass =
    tone === 'busy'
      ? 'bg-fuchsia-400/55'
      : tone === 'answer'
        ? 'bg-warn-400/55'
        : 'bg-sky-400/30';
  const cursorClass =
    tone === 'busy'
      ? 'text-fuchsia-500 drop-shadow-[0_2px_8px_rgba(217,70,239,0.85)]'
      : tone === 'answer'
        ? 'text-warn-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.85)]'
        : 'text-sky-500 drop-shadow-[0_2px_6px_rgba(14,165,233,0.75)]';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] hidden md:block"
      aria-hidden="true"
    >
      {/* Cursor sprite */}
      <motion.div
        className="absolute"
        style={{ left: 0, top: 0, x: pos.x, y: pos.y }}
        animate={{
          scale: agentControlled ? 1.15 : 1,
        }}
        transition={{ scale: { duration: 0.25 } }}
      >
        {/* Soft halo */}
        <span
          className={`absolute -inset-3 rounded-full blur-md transition-colors duration-500 ${haloClass}`}
        />
        {/* Spinning ring while busy */}
        {state.agentBusy && (
          <motion.span
            className="absolute -inset-3 rounded-full border-2 border-fuchsia-400/70 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.0, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {/* Cursor body */}
        <svg
          viewBox="0 0 24 24"
          className={`relative h-[22px] w-[22px] transition-colors duration-300 ${cursorClass}`}
          fill="currentColor"
        >
          <path
            d="M4 3.2 17.6 12.2l-6.4 1.5 2.5 6.6-2.4 1-2.5-6.6L4 19.8z"
            stroke="white"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {/* Speaking indicator — bouncing dots, like a tiny mouth. */}
        {state.speaking && (
          <span className="absolute -top-2 left-7 flex items-end gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-[3px] rounded-full bg-warn-500"
                animate={{ height: ['4px', '11px', '4px'] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.12,
                }}
              />
            ))}
          </span>
        )}
      </motion.div>

      {/* Pointer pulse at target — visual cue that Clicky is *answering* */}
      {agentControlled && (
        <motion.span
          className="absolute h-3 w-3 rounded-full bg-warn-500/70"
          style={{ left: 0, top: 0, x: pos.x - 6, y: pos.y + 16 }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
    </div>
  );
}
