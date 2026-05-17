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
  type PageTarget,
} from './agent';
import { speak, stopSpeaking } from './tts';

// Hard cap on the round trip — the project's chat budget is ≤ 2 s end to end.
// At 1800 ms the backend (1500 ms LLM ceiling + a margin) has already given
// up, so we don't waste UX time waiting on it.
const INTENT_TIMEOUT_MS = 1800;

interface ServerAction {
  action: 'point' | 'explain';
  uid: string | null;
  spoken: string;
  source: 'llm' | 'fallback';
}

/**
 * Ask the API's Clicky brain. Falls back to the local keyword matcher on
 * any error or timeout so the UI always gets a usable action.
 */
async function askAgent(
  transcript: string,
  locale: Locale,
  targets: PageTarget[],
): Promise<AgentAction> {
  try {
    const res = await fetch('/api/clicky/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        locale,
        page: window.location.pathname,
        targets: targets.map((t) => ({
          uid: t.uid,
          label: t.label,
          keywords: t.keywords,
          hint: t.hint,
        })),
      }),
      signal: AbortSignal.timeout(INTENT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`intent ${res.status}`);
    const data = (await res.json()) as ServerAction;
    if (data.action === 'point' && data.uid) {
      return { type: 'point', uid: data.uid, hint: data.spoken, spoken: data.spoken };
    }
    return { type: 'noop', spoken: data.spoken };
  } catch {
    // Local fallback — same shape, deterministic. The user gets *some*
    // answer; the bubble doesn't hang.
    return runLocalAgent({ transcript, targets });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Voice driver for Clicky.
//
//   1. Hold the hotkey (default: backtick `) to talk.
//   2. Release → STT finalizes → agent runs.
//   3. Agent picks a DOM element to point at; Clicky animates there AND
//      speaks the answer aloud (browser TTS).
//
// No text bubble. The cursor is the visual, the voice is the explanation.
// ──────────────────────────────────────────────────────────────────────────

export interface UseClickyAgent {
  recording: boolean;
  transcript: string;
  lastAction: AgentAction | null;
  thinking: boolean;
  supported: boolean;
  toggle: () => void;
  askText: (question: string) => void;
}

interface UseClickyAgentOpts {
  /** Hotkey character. Default '`' (backtick). */
  hotkey?: string;
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

  const { goToElement, setAgentBusy, setSpeaking } = useClicky();
  const [lastAction, setLastAction] = useState<AgentAction | null>(null);
  const [thinking, setThinking] = useState(false);
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

      const targets = scanPageTargets();
      void askAgent(transcript, locale, targets).then((action) => {
        setLastAction(action);
        if (action.type === 'point') {
          const el = findTargetElement(action.uid);
          if (el) {
            goToElement(el, 5000);
            speakLine(action.spoken, locale, setSpeaking);
          } else {
            speakLine(action.spoken, locale, setSpeaking);
            setAgentBusy(false);
          }
        } else {
          speakLine(action.spoken, locale, setSpeaking);
          setAgentBusy(false);
        }
        setThinking(false);
      });
    },
    [goToElement, setAgentBusy, setSpeaking, locale],
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
        speakLine("I didn't hear anything. Try again.", locale, setSpeaking);
      } else if (kind === 'not-allowed') {
        speakLine('Microphone permission was blocked.', locale, setSpeaking);
      } else if (kind === 'unsupported') {
        // No TTS speakLine here — likely the whole speech stack is unsupported.
      } else {
        speakLine('Voice recognition stumbled. Try again.', locale, setSpeaking);
      }
    },
  });

  const start = useCallback(() => {
    if (!stt.supported) return;
    stopSpeaking(); // cut Clicky off if it's mid-sentence
    setSpeaking(false);
    setAgentBusy(false);
    stt.start();
  }, [stt, setSpeaking, setAgentBusy]);

  const stop = useCallback(() => {
    stt.stop();
  }, [stt]);

  const toggle = useCallback(() => {
    if (stt.listening) stop();
    else start();
  }, [stt.listening, start, stop]);

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

function speakLine(
  text: string,
  locale: Locale,
  setSpeaking: (b: boolean) => void,
): void {
  speak(text, {
    locale,
    onStart: () => setSpeaking(true),
    onEnd: () => setSpeaking(false),
    onError: () => setSpeaking(false),
  });
}
