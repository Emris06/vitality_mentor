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
// What it does: hovers above-right of the real cursor with a soft glow,
// and shows a one-line tip about what to do next. Tips come from three
// places, in priority order:
//
//   1. Imperative pushHint() / setSticky() from page code (highest)
//   2. Hover over any element carrying `data-clicky-hint="..."`
//   3. The fallback set by setFallback() (lowest, shown when idle)
//
// Pages opt in by calling enable() in a useEffect, and opt out on unmount.
// Off by default so the rest of the app stays neutral.
// ──────────────────────────────────────────────────────────────────────────

interface ClickyState {
  enabled: boolean;
  /** Pinned hint set by a page; takes precedence over hover hints. */
  sticky: string | null;
  /** Hint from the currently-hovered element. */
  hover: string | null;
  /** Quiet default shown when nothing else is active. */
  fallback: string | null;
}

interface ClickyApi {
  enable: () => void;
  disable: () => void;
  /** Set a sticky hint. Pass null to clear. */
  setSticky: (hint: string | null) => void;
  /** Quiet idle-state hint. */
  setFallback: (hint: string | null) => void;
  /** One-shot hint with auto-dismiss (default 3.5s). */
  pushHint: (hint: string, ms?: number) => void;
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
};

export function ClickyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClickyState>(INITIAL_STATE);
  const [cursor, setCursor] = useState<{ x: number; y: number }>(() => ({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  }));
  const oneShotTimer = useRef<number | null>(null);

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

  // ── Cursor tracking (always on when enabled, very cheap) ──
  useEffect(() => {
    if (!state.enabled) return;
    function onMove(ev: PointerEvent) {
      setCursor({ x: ev.clientX, y: ev.clientY });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [state.enabled]);

  // ── Hover hint detection: walk up the DOM to find data-clicky-hint ──
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
    };
  }, []);

  const value = useMemo<ClickyContextValue>(
    () => ({ state, cursor, enable, disable, setSticky, setFallback, pushHint }),
    [state, cursor, enable, disable, setSticky, setFallback, pushHint],
  );

  return (
    <ClickyContext.Provider value={value}>
      {children}
      {state.enabled && <Clicky cursor={cursor} state={state} onDismiss={() => setSticky(null)} />}
    </ClickyContext.Provider>
  );
}

export function useClicky(): ClickyApi {
  const ctx = useContext(ClickyContext);
  if (!ctx) {
    throw new Error('useClicky() must be used inside <ClickyProvider>');
  }
  const { enable, disable, setSticky, setFallback, pushHint } = ctx;
  return { enable, disable, setSticky, setFallback, pushHint };
}

/**
 * Convenience hook: enables Clicky on mount, disables on unmount.
 * Pages that always want Clicky should call this once at the top.
 */
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

/** Resolve which hint should be shown right now. */
export function resolveActiveHint(state: ClickyState): string | null {
  return state.sticky ?? state.hover ?? state.fallback ?? null;
}
