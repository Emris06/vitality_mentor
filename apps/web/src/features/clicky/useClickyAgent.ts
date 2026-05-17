import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { useSpeechRecognition } from '../chat/voice/useSpeechRecognition';
import { useClicky } from './ClickyProvider';
import {
  findTargetElement,
  runLocalAgent,
  scanPageTargets,
  type AgentAction,
} from './agent';

// ──────────────────────────────────────────────────────────────────────────
// Voice driver for Clicky.
//
//   1. Hold the hotkey (default: backtick `) to talk.
//   2. Release → STT finalizes → agent runs.
//   3. Agent picks a DOM element to point at; Clicky animates there.
//
// Backend swap: replace `runLocalAgent(input)` with a fetch to the AI
// service. The shape (`AgentInput` → `AgentAction`) is the only contract
// the rest of the app depends on.
// ──────────────────────────────────────────────────────────────────────────

export interface UseClickyAgent {
  /** True while the user is holding the hotkey and the mic is open. */
  recording: boolean;
  /** Interim STT transcript (updates live while listening). */
  transcript: string;
  /** Agent's last response (whether it pointed somewhere or not). */
  lastAction: AgentAction | null;
  /** True between transcript submit and the cursor finishing its move. */
  thinking: boolean;
  /** True when the browser supports STT for the current locale. */
  supported: boolean;
  /** Programmatic equivalent of holding the key (for click-to-talk). */
  toggle: () => void;
  /** Submit a text question (skip the mic). Useful for click-to-type fallback. */
  askText: (question: string) => void;
}

interface UseClickyAgentOpts {
  /** Hotkey character. Default '`' (backtick). */
  hotkey?: string;
  /** Set false to disable the hook entirely (e.g., not on this page). */
  enabled?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useClickyAgent(opts: UseClickyAgentOpts = {}): UseClickyAgent {
  const hotkey = opts.hotkey ?? '`';
  const enabled = opts.enabled !== false;
  const { i18n } = useTranslation();
  const locale: Locale = (() => {
    const r = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(r) ? r : DEFAULT_LOCALE;
  })();

  const { goToElement, pushHint, setAgentBusy } = useClicky();
  const [lastAction, setLastAction] = useState<AgentAction | null>(null);
  const [thinking, setThinking] = useState(false);
  // Guard: a held key fires repeatedly; we only want one start.
  const keyDownRef = useRef(false);

  const runAgentOn = useCallback(
    (text: string) => {
      const transcript = text.trim();
      if (!transcript) {
        setThinking(false);
        setAgentBusy(false);
        return;
      }
      setThinking(true);
      setAgentBusy(true);

      // Frontend-only stub. Swap for `await fetch('/api/clicky/intent', …)`
      // when the backend exists.
      const targets = scanPageTargets();
      const action = runLocalAgent({ transcript, targets });
      setLastAction(action);

      // Tiny artificial delay so the "thinking" state is perceptible —
      // makes the agent feel intentional instead of a reflex.
      window.setTimeout(() => {
        if (action.type === 'point') {
          const el = findTargetElement(action.uid);
          if (el) {
            goToElement(el, action.hint, 5000);
          } else {
            pushHint(action.spoken, 4000);
            setAgentBusy(false);
          }
        } else {
          pushHint(action.spoken, 4000);
          setAgentBusy(false);
        }
        setThinking(false);
      }, 320);
    },
    [goToElement, pushHint, setAgentBusy],
  );

  const stt = useSpeechRecognition({
    locale,
    onFinal: (text) => {
      runAgentOn(text);
    },
    onError: (kind) => {
      setAgentBusy(false);
      setThinking(false);
      if (kind === 'no-speech') {
        pushHint("I didn't hear anything — try holding the key longer.", 3000);
      } else if (kind === 'not-allowed') {
        pushHint('Microphone permission was blocked. Allow it to talk to me.', 4500);
      } else if (kind === 'unsupported') {
        pushHint('Voice is not supported in this browser. Try Chrome or Edge.', 4500);
      } else {
        pushHint('Voice recognition stumbled. Try again in a moment.', 3000);
      }
    },
  });

  const start = useCallback(() => {
    if (!stt.supported) {
      pushHint('Voice is not supported here. Try Chrome or Edge.', 3500);
      return;
    }
    setAgentBusy(false); // reset stale busy
    stt.start();
  }, [stt, pushHint, setAgentBusy]);

  const stop = useCallback(() => {
    stt.stop();
  }, [stt]);

  const toggle = useCallback(() => {
    if (stt.listening) stop();
    else start();
  }, [stt.listening, start, stop]);

  // Hold-to-talk hotkey.
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== hotkey) return;
      if (ev.repeat) return;
      if (isTypingTarget(ev.target)) return;
      if (keyDownRef.current) return;
      keyDownRef.current = true;
      ev.preventDefault();
      start();
    }
    function onKeyUp(ev: KeyboardEvent) {
      if (ev.key !== hotkey) return;
      if (!keyDownRef.current) return;
      keyDownRef.current = false;
      ev.preventDefault();
      stop();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled, hotkey, start, stop]);

  return {
    recording: stt.listening,
    transcript: stt.transcript,
    lastAction,
    thinking,
    supported: stt.supported,
    toggle,
    askText: runAgentOn,
  };
}
