import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Clicky } from './Clicky';

// ──────────────────────────────────────────────────────────────────────────
// Clicky — voice-driven companion cursor.
//
// Communicates two ways: by MOVING (target mode — driven by the agent) and
// by SPEAKING (TTS — driven by useClickyAgent). No text bubble anymore —
// the cursor itself is the entire visual.
//
// Two modes:
//   • Follow mode (default): trails the real cursor with an offset.
//   • Target mode: the agent has chosen an element; Clicky animates there
//     and the speaking indicator pulses while TTS reads the answer.
// ──────────────────────────────────────────────────────────────────────────

export interface ClickyTarget {
  x: number;
  y: number;
  /** How long to stay pinned at the target (ms). */
  pinMs: number;
}

interface ClickyState {
  enabled: boolean;
  /** When set, Clicky goes to this screen-space point instead of the cursor. */
  target: ClickyTarget | null;
  /** Visual cue that the agent is thinking. */
  agentBusy: boolean;
  /** Visual cue that TTS is currently reading the answer aloud. */
  speaking: boolean;
}

interface ClickyApi {
  enable: () => void;
  disable: () => void;
  /** Drive Clicky to an element. Auto-releases after pinMs (default 4500). */
  goToElement: (el: HTMLElement, pinMs?: number) => void;
  releaseTarget: () => void;
  setAgentBusy: (busy: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
}

interface ClickyContextValue extends ClickyApi {
  state: ClickyState;
  cursor: { x: number; y: number };
}

const ClickyContext = createContext<ClickyContextValue | null>(null);

const INITIAL_STATE: ClickyState = {
  enabled: false,
  target: null,
  agentBusy: false,
  speaking: false,
};

export function ClickyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClickyState>(INITIAL_STATE);
  const [cursor, setCursor] = useState<{ x: number; y: number }>(() => ({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  }));
  const pinTimer = useRef<number | null>(null);

  const enable = useCallback(() => {
    setState((s) => (s.enabled ? s : { ...s, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setState(() => ({ ...INITIAL_STATE }));
    if (pinTimer.current) {
      window.clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
  }, []);

  const setAgentBusy = useCallback((busy: boolean) => {
    setState((s) => ({ ...s, agentBusy: busy }));
  }, []);

  const setSpeaking = useCallback((speaking: boolean) => {
    setState((s) => ({ ...s, speaking }));
  }, []);

  const releaseTarget = useCallback(() => {
    if (pinTimer.current) {
      window.clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
    setState((s) => ({ ...s, target: null }));
  }, []);

  const goToElement = useCallback((el: HTMLElement, pinMs = 4500) => {
    const r = el.getBoundingClientRect();
    // Aim slightly off the top-right corner so Clicky is visibly *pointing*
    // at the element instead of sitting on top of it.
    const x = r.right - 8;
    const y = r.top + Math.min(18, r.height / 2);
    setState((s) => ({ ...s, target: { x, y, pinMs }, agentBusy: false }));
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (pinTimer.current) window.clearTimeout(pinTimer.current);
    pinTimer.current = window.setTimeout(() => {
      setState((s) => ({ ...s, target: null }));
      pinTimer.current = null;
    }, pinMs);
  }, []);

  // Cursor tracking.
  useEffect(() => {
    if (!state.enabled) return;
    function onMove(ev: PointerEvent) {
      setCursor({ x: ev.clientX, y: ev.clientY });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [state.enabled]);

  useEffect(() => {
    return () => {
      if (pinTimer.current) window.clearTimeout(pinTimer.current);
    };
  }, []);

  const value = useMemo<ClickyContextValue>(
    () => ({
      state,
      cursor,
      enable,
      disable,
      goToElement,
      releaseTarget,
      setAgentBusy,
      setSpeaking,
    }),
    [state, cursor, enable, disable, goToElement, releaseTarget, setAgentBusy, setSpeaking],
  );

  return (
    <ClickyContext.Provider value={value}>
      {children}
      {state.enabled && <Clicky cursor={cursor} state={state} />}
    </ClickyContext.Provider>
  );
}

export function useClicky(): ClickyApi {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClicky() must be used inside <ClickyProvider>');
  }
  const { enable, disable, goToElement, releaseTarget, setAgentBusy, setSpeaking } = ctx;
  return { enable, disable, goToElement, releaseTarget, setAgentBusy, setSpeaking };
}

export function useClickyState(): ClickyState {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClickyState() must be used inside <ClickyProvider>');
  }
  return ctx.state;
}

/** Convenience: enable Clicky on mount, disable on unmount. */
export function useClickyEnabled(active = true): void {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClickyEnabled() must be used inside <ClickyProvider>');
  }
  const { enable, disable } = ctx;
  useEffect(() => {
    if (!active) return;
    enable();
    return () => disable();
  }, [active, enable, disable]);
}
