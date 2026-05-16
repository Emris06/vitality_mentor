import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@vitality/shared';
import { isTtsSupported, pickTtsVoice } from './speechCapabilities';

export interface UseSpeechSynthesis {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  speak: (text: string) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  lastErrorKind: string | null;
}

export function useSpeechSynthesis(locale: Locale): UseSpeechSynthesis {
  const supported = isTtsSupported();
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastErrorRef = useRef<string | null>(null);
  const localeRef = useRef<Locale>(locale);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  // Cancel any pending utterance when the hook unmounts.
  useEffect(() => {
    return () => {
      if (!supported) return;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      const trimmed = text?.trim();
      if (!trimmed) return;

      try {
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(trimmed);
        const voice = pickTtsVoice(localeRef.current);
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        } else {
          // Fall back to BCP-47 hint — engine may still pick a default voice.
          utter.lang =
            localeRef.current === 'uz'
              ? 'uz-UZ'
              : localeRef.current === 'ru'
                ? 'ru-RU'
                : 'en-US';
        }
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;

        utter.onstart = () => {
          setSpeaking(true);
          setPaused(false);
        };
        utter.onend = () => {
          setSpeaking(false);
          setPaused(false);
        };
        utter.onerror = (ev: SpeechSynthesisErrorEvent) => {
          lastErrorRef.current = ev.error ?? 'generic';
          setSpeaking(false);
          setPaused(false);
        };
        utter.onpause = () => setPaused(true);
        utter.onresume = () => setPaused(false);

        window.speechSynthesis.speak(utter);
      } catch (err) {
        lastErrorRef.current = (err as Error)?.message ?? 'generic';
        setSpeaking(false);
      }
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.pause();
      setPaused(true);
    } catch {
      // ignore
    }
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.resume();
      setPaused(false);
    } catch {
      // ignore
    }
  }, [supported]);

  return {
    supported,
    speaking,
    paused,
    speak,
    cancel,
    pause,
    resume,
    lastErrorKind: lastErrorRef.current,
  };
}
