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
// Clicky — a small companion cursor for the Intern flow.
//
// Two modes:
//   • Follow mode (default): trails the real cursor with an offset, shows
//     a hint from hover (data-clicky-hint) or a pinned hint.
//   • Target mode: an agent has decided Clicky should point at a specific
//     element on screen. Clicky animates there and stays for `pinMs`.
//
// Hint priority when in follow mode: sticky > hover > fallback.
// ──────────────────────────────────────────────────────────────────────────

export interface ClickyTarget {
  x: number;
  y: number;
  hint: string;
  /** How long to stay pinned at the target (ms). */
  pinMs: number;
}

interface ClickyState {
  enabled: boolean;
  sticky: string | null;
  hover: string | null;
  fallback: string | null;
  /** When set, Clicky goes to this screen-space point instead of the cursor. */
  target: ClickyTarget | null;
  /** Visual cue that the agent is thinking. */
  agentBusy: boolean;
}

interface ClickyApi {
  enable: () => void;
  disable: () => void;
  setSticky: (hint: string | null) => void;
  setFallback: (hint: string | null) => void;
  pushHint: (hint: string, ms?: number) => void;
  /** Drive Clicky to an element. Auto-releases after pinMs (default 4500). */
  goToElement: (el: HTMLElement, hint: string, pinMs?: number) => void;
  releaseTarget: () => void;
  setAgentBusy: (busy: boolean) => void;
}

interface ClickyContextValue extends ClickyApi {
  state: ClickyState;
  cursor: { x: number; y: number };
}

const ClickyContext = createContext<ClickyContextValue | null>(null);

const INITIAL_STATE: ClickyState = {
  enabled: false,
  sticky: null,
  hover: null,
  fallback: null,
  target: null,
  agentBusy: false,
};

export function ClickyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClickyState>(INITIAL_STATE);
  const [cursor, setCursor] = useState<{ x: number; y: number }>(() => ({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  }));
  const oneShotTimer = useRef<number | null>(null);
  const pinTimer = useRef<number | null>(null);

  // ── Imperative API ──
  const enable = useCallback(() => {
    setState((s) => (s.enabled ? s : { ...s, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setState(() => ({ ...INITIAL_STATE }));
    if (oneShotTimer.current) {
      window.clearTimeout(oneShotTimer.current);
      oneShotTimer.current = null;
    }
    if (pinTimer.current) {
      window.clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
  }, []);

  const setSticky = useCallback((hint: string | null) => {
    setState((s) => ({ ...s, sticky: hint }));
  }, []);

  const setFallback = useCallback((hint: string | null) => {
    setState((s) => ({ ...s, fallback: hint }));
  }, []);

  const pushHint = useCallback((hint: string, ms = 3500) => {
    setState((s) => ({ ...s, sticky: hint }));
    if (oneShotTimer.current) window.clearTimeout(oneShotTimer.current);
    oneShotTimer.current = window.setTimeout(() => {
      setState((s) => ({ ...s, sticky: null }));
      oneShotTimer.current = null;
    }, ms);
  }, []);

  const setAgentBusy = useCallback((busy: boolean) => {
    setState((s) => ({ ...s, agentBusy: busy }));
  }, []);

  const releaseTarget = useCallback(() => {
    if (pinTimer.current) {
      window.clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
    setState((s) => ({ ...s, target: null }));
  }, []);

  const goToElement = useCallback(
    (el: HTMLElement, hint: string, pinMs = 4500) => {
      const r = el.getBoundingClientRect();
      // Aim slightly off the top-right corner so Clicky is visibly *pointing*
      // at the element instead of sitting on top of it.
      const x = r.right - 8;
      const y = r.top + Math.min(18, r.height / 2);
      setState((s) => ({
        ...s,
        target: { x, y, hint, pinMs },
        agentBusy: false,
      }));
      // Optional: scroll into view if the element is off-screen.
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (pinTimer.current) window.clearTimeout(pinTimer.current);
      pinTimer.current = window.setTimeout(() => {
        setState((s) => ({ ...s, target: null }));
        pinTimer.current = null;
      }, pinMs);
    },
    [],
  );

  // ── Cursor tracking ──
  useEffect(() => {
    if (!state.enabled) return;
    function onMove(ev: PointerEvent) {
      setCursor({ x: ev.clientX, y: ev.clientY });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [state.enabled]);

  // ── Hover hint detection ──
  useEffect(() => {
    if (!state.enabled) return;
    function onMove(ev: PointerEvent) {
      const target = ev.target as Element | null;
      if (!target) return;
      const el = target.closest<HTMLElement>('[data-clicky-hint]');
      const hint = el?.dataset.clickyHint ?? null;
      setState((s) => (s.hover === hint ? s : { ...s, hover: hint }));
    }
    window.addEventListener('pointerover', onMove, { passive: true });
    return () => window.removeEventListener('pointerover', onMove);
  }, [state.enabled]);

  useEffect(() => {
    return () => {
      if (oneShotTimer.current) window.clearTimeout(oneShotTimer.current);
      if (pinTimer.current) window.clearTimeout(pinTimer.current);
    };
  }, []);

  const value = useMemo<ClickyContextValue>(
    () => ({
      state,
      cursor,
      enable,
      disable,
      setSticky,
      setFallback,
      pushHint,
      goToElement,
      releaseTarget,
      setAgentBusy,
    }),
    [
      state,
      cursor,
      enable,
      disable,
      setSticky,
      setFallback,
      pushHint,
      goToElement,
      releaseTarget,
      setAgentBusy,
    ],
  );

  return (
    <ClickyContext.Provider value={value}>
      {children}
      {state.enabled && (
        <Clicky cursor={cursor} state={state} onDismiss={() => setSticky(null)} />
      )}
    </ClickyContext.Provider>
  );
}

export function useClicky(): ClickyApi {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClicky() must be used inside <ClickyProvider>');
  }
  const {
    enable,
    disable,
    setSticky,
    setFallback,
    pushHint,
    goToElement,
    releaseTarget,
    setAgentBusy,
  } = ctx;
  return {
    enable,
    disable,
    setSticky,
    setFallback,
    pushHint,
    goToElement,
    releaseTarget,
    setAgentBusy,
  };
}

/** Read the current Clicky state (for the agent overlay). */
export function useClickyState(): ClickyState {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClickyState() must be used inside <ClickyProvider>');
  }
  return ctx.state;
}

/** Convenience: enable Clicky on mount, disable on unmount. */
export function useClickyEnabled(fallback?: string): void {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClickyEnabled() must be used inside <ClickyProvider>');
  }
  const { enable, disable, setFallback } = ctx;
  useEffect(() => {
    enable();
    if (fallback !== undefined) setFallback(fallback);
    return () => disable();
  }, [enable, disable, setFallback, fallback]);
}

export function resolveActiveHint(state: ClickyState): string | null {
  if (state.target) return state.target.hint;
  return state.sticky ?? state.hover ?? state.fallback ?? null;
}
