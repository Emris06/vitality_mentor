import { useEffect, useRef, useState } from 'react'; // useState used for pos
import type { ClickyTarget } from './ClickyProvider';

// ClickyTarget has x/y coords but no element reference — highlight ring
// is approximated with a fixed-size pulse at the target point.

interface ClickyProps {
  cursor: { x: number; y: number };
  state: {
    enabled: boolean;
    target: ClickyTarget | null;
    agentBusy: boolean;
    speaking: boolean;
  };
}

// Clicky follows the cursor with an eased offset (personality: slightly lazy).
// In target mode the agent took over and it moves to a DOM element.
const CURSOR_OFFSET = { x: 16, y: -22 };
const EASE_FOLLOW = 0.12;
const EASE_TARGET = 0.28;

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
  const listening = state.agentBusy;

  return (
    <div
      className="clicky-wrap"
      style={{ left: pos.x, top: pos.y, display: 'none' }}
      // Show only on md+ — matches reference prototype behaviour
      aria-hidden="true"
      ref={(el) => {
        if (el) el.style.display = window.innerWidth >= 768 ? 'block' : 'none';
      }}
    >
      {/* Highlight pulse at target point */}
      {agentControlled && state.target && (
        <div
          className="clicky-highlight"
          style={{
            left: state.target.x - 28,
            top: state.target.y - 28,
            width: 56,
            height: 56,
            position: 'fixed',
          }}
        />
      )}

      {/* 56px cobalt circle */}
      <div className={`clicky${listening ? ' listening' : ''}`}>
        <div className="clicky-burst" aria-hidden="true">
          <i /><i /><i /><i />
        </div>

        {/* Speaking indicator — wave bars above the circle */}
        {state.speaking && (
          <div
            style={{
              position: 'absolute',
              top: '-18px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              height: '14px',
            }}
          >
            {[6, 10, 14, 8, 12].map((h, i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: '2px',
                  height: `${h}px`,
                  borderRadius: '1px',
                  background: 'white',
                  animation: `wave 0.9s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

