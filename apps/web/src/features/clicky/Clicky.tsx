import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { resolveActiveHint } from './ClickyProvider';

interface ClickyProps {
  cursor: { x: number; y: number };
  state: {
    enabled: boolean;
    sticky: string | null;
    hover: string | null;
    fallback: string | null;
  };
  onDismiss: () => void;
}

// Clicky floats slightly above-right of the real cursor. The eased follow
// gives it personality — a touch lazy, never jumpy.
const OFFSET = { x: 16, y: -22 };
const FOLLOW_EASE = 0.18; // 0..1 — higher = snappier, lower = lazier

export function Clicky({ cursor, state, onDismiss }: ClickyProps) {
  // Eased position, decoupled from the real cursor so it trails smoothly.
  const [pos, setPos] = useState(() => ({
    x: cursor.x + OFFSET.x,
    y: cursor.y + OFFSET.y,
  }));
  const target = useRef({ x: cursor.x + OFFSET.x, y: cursor.y + OFFSET.y });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    target.current = { x: cursor.x + OFFSET.x, y: cursor.y + OFFSET.y };
  }, [cursor.x, cursor.y]);

  useEffect(() => {
    function tick() {
      setPos((p) => {
        const dx = target.current.x - p.x;
        const dy = target.current.y - p.y;
        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
          return { x: target.current.x, y: target.current.y };
        }
        return { x: p.x + dx * FOLLOW_EASE, y: p.y + dy * FOLLOW_EASE };
      });
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const hint = resolveActiveHint(state);
  const showBubble = !!hint;

  // Clamp bubble onto screen — if Clicky is near the right edge, flip the
  // bubble to the left so it doesn't get cut off.
  const bubbleOnLeft = typeof window !== 'undefined' && pos.x > window.innerWidth - 280;

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
          rotate: showBubble ? [-2, 2, -2] : 0,
        }}
        transition={{
          rotate: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        {/* Soft halo */}
        <span
          className={`absolute -inset-3 rounded-full blur-md transition-colors duration-500 ${
            showBubble ? 'bg-sky-400/45' : 'bg-sky-400/25'
          }`}
        />
        {/* Cursor body */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-[22px] w-[22px] text-sky-500 drop-shadow-[0_2px_6px_rgba(14,165,233,0.75)]"
          fill="currentColor"
        >
          <path
            d="M4 3.2 17.6 12.2l-6.4 1.5 2.5 6.6-2.4 1-2.5-6.6L4 19.8z"
            stroke="white"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {/* Idle bob */}
        <motion.span
          className="absolute -bottom-1 left-1 h-1 w-1 rounded-full bg-sky-300"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            key={hint}
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
            <div className="relative max-w-[260px] rounded-lg border border-sky-200 bg-white px-3 py-2 shadow-pop">
              {/* Tail */}
              <span
                className={`absolute top-3 h-2 w-2 rotate-45 border border-sky-200 bg-white ${
                  bubbleOnLeft
                    ? 'right-[-5px] border-l-0 border-t-0'
                    : 'left-[-5px] border-r-0 border-b-0'
                }`}
              />
              <div className="flex items-start gap-2">
                <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                  Cli
                </span>
                <p className="text-[13px] leading-snug text-ink-800">{hint}</p>
                {state.sticky && (
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
