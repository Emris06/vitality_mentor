import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@vitality/shared';
import {
  getSpeechRecognitionCtor,
  isSttSupported,
  localeToBcp47,
} from './speechCapabilities';

export type SttErrorKind =
  | 'no-speech'
  | 'not-allowed'
  | 'network'
  | 'unsupported'
  | 'generic';

export interface UseSpeechRecognitionOpts {
  locale: Locale;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (kind: SttErrorKind, original?: unknown) => void;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
}

function classifyError(code: string | undefined): SttErrorKind {
  switch (code) {
    case 'no-speech':
      return 'no-speech';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'unsupported';
    default:
      return 'generic';
  }
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOpts,
): UseSpeechRecognition {
  const { locale, onFinal, onInterim, onError } = opts;
  const supported = isSttSupported(locale);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recogRef = useRef<SpeechRecognition | null>(null);
  const localeRef = useRef<Locale>(locale);
  const callbacksRef = useRef({ onFinal, onInterim, onError });

  // Keep refs fresh — handlers stay stable without resubscribing.
  useEffect(() => {
    callbacksRef.current = { onFinal, onInterim, onError };
  }, [onFinal, onInterim, onError]);

  // If locale changes mid-listen, stop and discard.
  useEffect(() => {
    if (localeRef.current !== locale && recogRef.current) {
      try {
        recogRef.current.abort();
      } catch {
        // ignore
      }
      setListening(false);
      setTranscript('');
    }
    localeRef.current = locale;
  }, [locale]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      try {
        recogRef.current?.abort();
      } catch {
        // ignore
      }
      recogRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      callbacksRef.current.onError?.('unsupported');
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      callbacksRef.current.onError?.('unsupported');
      return;
    }
    // Abort any previous instance.
    try {
      recogRef.current?.abort();
    } catch {
      // ignore
    }

    const recog: SpeechRecognition = new Ctor();
    recog.lang = localeToBcp47(locale);
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    setTranscript('');

    recog.onstart = () => {
      setListening(true);
    };

    recog.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (!r) continue;
        const alt = r[0]?.transcript ?? '';
        if (r.isFinal) {
          finalText += alt;
        } else {
          interim += alt;
        }
      }
      if (interim) {
        setTranscript(interim);
        callbacksRef.current.onInterim?.(interim);
      }
      if (finalText) {
        const trimmed = finalText.trim();
        setTranscript(trimmed);
        if (trimmed.length > 0) {
          callbacksRef.current.onFinal?.(trimmed);
        }
      }
    };

    recog.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const kind = classifyError(ev.error);
      callbacksRef.current.onError?.(kind, ev);
    };

    recog.onend = () => {
      setListening(false);
    };

    recogRef.current = recog;
    try {
      recog.start();
    } catch (err) {
      callbacksRef.current.onError?.('generic', err);
      setListening(false);
    }
  }, [locale, supported]);

  const stop = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  return { supported, listening, transcript, start, stop };
}
