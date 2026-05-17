import type { Locale } from '@vitality/shared';

// ──────────────────────────────────────────────────────────────────────────
// Tiny TTS wrapper around the browser's SpeechSynthesis API.
//
// Why browser-native and not a cloud TTS:
//   • Zero API key, zero latency, fits the ≤ 2 s budget trivially.
//   • Good RU and EN voices on Chrome / Edge / Safari out of the box.
//   • UZ support is patchy; we degrade to RU as the closest voice.
//
// Upgrade path: swap `speak()` to call a server endpoint that returns audio
// from ElevenLabs / OpenAI TTS / Azure. The signature stays the same.
// ──────────────────────────────────────────────────────────────────────────

const LOCALE_BCP47: Record<Locale, string[]> = {
  uz: ['uz-UZ', 'uz', 'ru-RU', 'ru'], // fall through to ru if uz voice missing
  ru: ['ru-RU', 'ru'],
  en: ['en-US', 'en-GB', 'en'],
};

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

function getVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) cachedVoices = v;
  return v;
}

// Pre-warm the voice list. Chromium populates voices async; the first call
// often returns []. We listen for the voiceschanged event once.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoices = window.speechSynthesis.getVoices();
  });
}

function pickVoice(locale: Locale): SpeechSynthesisVoice | null {
  const tags = LOCALE_BCP47[locale] ?? ['en-US'];
  const voices = getVoices();
  for (const tag of tags) {
    // Exact lang match first, then prefix match.
    const exact = voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const prefix = voices.find((v) =>
      v.lang.toLowerCase().startsWith(tag.split('-')[0]!.toLowerCase()),
    );
    if (prefix) return prefix;
  }
  return voices[0] ?? null;
}

export interface SpeakOpts {
  locale: Locale;
  /** 0.1 – 10. Default 1. Slightly faster reads better for short hints. */
  rate?: number;
  /** 0 – 1. Default 1. */
  volume?: number;
  /** 0 – 2. Default 1. */
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/** Speak text. Cancels anything currently being said. */
export function speak(text: string, opts: SpeakOpts): void {
  if (!isTtsSupported()) {
    opts.onError?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel(); // never queue — Clicky only ever says one thing at a time

  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(opts.locale);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  utter.rate = opts.rate ?? 1.05;
  utter.volume = opts.volume ?? 1;
  utter.pitch = opts.pitch ?? 1;

  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onError?.();

  // Some browsers (Chrome on Windows) stall speak() if called immediately
  // after cancel(). Defer one tick to dodge that.
  window.setTimeout(() => synth.speak(utter), 0);
}

/** Stop whatever Clicky is currently saying. */
export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}
