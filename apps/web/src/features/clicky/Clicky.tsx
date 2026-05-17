import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { resolveActiveHint, type ClickyTarget } from './ClickyProvider';

interface ClickyProps {
  cursor: { x: number; y: number };
  state: {
    enabled: boolean;
    sticky: string | null;
    hover: string | null;
    fallback: string | null;
    target: ClickyTarget | null;
    agentBusy: boolean;
  };
  onDismiss: () => void;
}

// Clicky floats above-right of the real cursor. Eased follow gives it
// personality — a touch lazy, never jumpy.
const CURSOR_OFFSET = { x: 16, y: -22 };
// When in target mode, Clicky moves faster (the agent took over, the user
// expects a visible response). Follow mode stays lazy.
const EASE_FOLLOW = 0.18;
const EASE_TARGET = 0.32;

export function Clicky({ cursor, state, onDismiss }: ClickyProps) {
  // Eased position, decoupled from the live cursor so motion is smooth.
  const [pos, setPos] = useState(() => ({
    x: cursor.x + CURSOR_OFFSET.x,
    y: cursor.y + CURSOR_OFFSET.y,
  }));
  const targetPos = useRef({ x: cursor.x + CURSOR_OFFSET.x, y: cursor.y + CURSOR_OFFSET.y });
  const inTargetMode = useRef(false);
  const rafId = useRef<number | null>(null);

  // Update the moving target. Target mode wins over cursor follow.
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

  const hint = resolveActiveHint(state);
  const showBubble = !!hint || state.agentBusy;
  const agentControlled = !!state.target;
  const bubbleText = state.agentBusy ? 'Thinking…' : hint;

  // Clamp bubble — flip to the left near right edge.
  const bubbleOnLeft = typeof window !== 'undefined' && pos.x > window.innerWidth - 280;

  // Color shifts: violet while busy, amber when answering (target mode),
  // sky in idle/follow.
  const tone = state.agentBusy ? 'busy' : agentControlled ? 'answer' : 'idle';
  const haloClass =
    tone === 'busy'
      ? 'bg-fuchsia-400/55'
      : tone === 'answer'
        ? 'bg-warn-400/55'
        : showBubble
          ? 'bg-sky-400/45'
          : 'bg-sky-400/25';
  const cursorClass =
    tone === 'busy'
      ? 'text-fuchsia-500 drop-shadow-[0_2px_8px_rgba(217,70,239,0.85)]'
      : tone === 'answer'
        ? 'text-warn-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.85)]'
        : 'text-sky-500 drop-shadow-[0_2px_6px_rgba(14,165,233,0.75)]';
  const bubbleBorder =
    tone === 'busy'
      ? 'border-fuchsia-200'
      : tone === 'answer'
        ? 'border-warn-200'
        : 'border-sky-200';
  const badgeClass =
    tone === 'busy'
      ? 'bg-fuchsia-100 text-fuchsia-700'
      : tone === 'answer'
        ? 'bg-warn-100 text-warn-700'
        : 'bg-sky-100 text-sky-700';

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
          rotate: showBubble && !agentControlled ? [-2, 2, -2] : 0,
          scale: agentControlled ? 1.15 : 1,
        }}
        transition={{
          rotate: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 0.25 },
        }}
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
        <motion.span
          className="absolute -bottom-1 left-1 h-1 w-1 rounded-full bg-sky-300"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      </motion.div>

      {/* Pointer arrow at target — extra visual cue that Clicky is *answering* */}
      {agentControlled && (
        <motion.span
          className="absolute h-3 w-3 rounded-full bg-warn-500/70"
          style={{ left: 0, top: 0, x: pos.x - 6, y: pos.y + 16 }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Speech bubble */}
      <AnimatePresence>
        {showBubble && bubbleText && (
          <motion.div
            key={bubbleText}
            className="pointer-events-auto absolute"
            style={{
              left: 0,
              top: 0,
              x: bubbleOnLeft ? pos.x - 268 : pos.x + 28,
              y: pos.y - 4,
            }}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div
              className={`relative max-w-[260px] rounded-lg border bg-white px-3 py-2 shadow-pop ${bubbleBorder}`}
            >
              {/* Tail */}
              <span
                className={`absolute top-3 h-2 w-2 rotate-45 border bg-white ${bubbleBorder} ${
                  bubbleOnLeft
                    ? 'right-[-5px] border-l-0 border-t-0'
                    : 'left-[-5px] border-r-0 border-b-0'
                }`}
              />
              <div className="flex items-start gap-2">
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold ${badgeClass}`}
                >
                  Cli
                </span>
                <p className="text-[13px] leading-snug text-ink-800">{bubbleText}</p>
                {state.sticky && !agentControlled && !state.agentBusy && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="ml-1 -mr-1 flex-none rounded text-ink-400 transition-colors hover:text-ink-700"
                    aria-label="Dismiss hint"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M3 3l10 10M13 3L3 13" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
