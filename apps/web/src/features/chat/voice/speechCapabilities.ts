import type { Locale } from '@vitality/shared';

// Map app locale → BCP-47 lang tag.
export function localeToBcp47(locale: Locale): string {
  switch (locale) {
    case 'uz':
      return 'uz-UZ';
    case 'ru':
      return 'ru-RU';
    case 'en':
    default:
      return 'en-US';
  }
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  return ctor ?? null;
}

function isFirefoxOrSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isFirefox = ua.includes('firefox');
  // Safari but not Chrome/Chromium/Edge.
  const isSafari =
    ua.includes('safari') &&
    !ua.includes('chrome') &&
    !ua.includes('chromium') &&
    !ua.includes('edg/');
  return isFirefox || isSafari;
}

/**
 * Whether SpeechRecognition is usable for a given locale.
 * For `uz`, Firefox/Safari lack Uzbek support → return false there.
 * Chromium-based browsers: trust and let the user discover quality.
 */
export function isSttSupported(locale: Locale): boolean {
  if (!getSpeechRecognitionCtor()) return false;
  if (locale === 'uz' && isFirefoxOrSafari()) return false;
  return true;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// --- TTS voice selection with caching ---

let cachedVoices: SpeechSynthesisVoice[] = [];
const cachedPicks = new Map<Locale, SpeechSynthesisVoice | null>();
let voicesChangedBound = false;

function refreshVoices(): void {
  if (!isTtsSupported()) return;
  try {
    cachedVoices = window.speechSynthesis.getVoices() ?? [];
    cachedPicks.clear();
  } catch {
    cachedVoices = [];
  }
}

function ensureVoicesBound(): void {
  if (voicesChangedBound) return;
  if (!isTtsSupported()) return;
  refreshVoices();
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
    };
    voicesChangedBound = true;
  } catch {
    // ignore — older browsers
  }
}

function findVoiceByLang(prefixes: string[]): SpeechSynthesisVoice | null {
  for (const prefix of prefixes) {
    const exact = cachedVoices.find(
      (v) => v.lang.toLowerCase() === prefix.toLowerCase(),
    );
    if (exact) return exact;
    const partial = cachedVoices.find((v) =>
      v.lang.toLowerCase().startsWith(prefix.toLowerCase().split('-')[0]),
    );
    if (partial) return partial;
  }
  return null;
}

/**
 * Returns the best TTS voice for a locale.
 * Fallback chains:
 *  - uz: uz-UZ → ru-RU (Russian voices are often serviceable for Uzbek listeners) → null
 *  - ru: ru-RU → null
 *  - en: en-US → en-GB → null
 */
export function pickTtsVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  ensureVoicesBound();
  if (cachedPicks.has(locale)) return cachedPicks.get(locale) ?? null;

  let voice: SpeechSynthesisVoice | null = null;
  if (locale === 'uz') {
    voice = findVoiceByLang(['uz-UZ', 'uz']) ?? findVoiceByLang(['ru-RU', 'ru']);
  } else if (locale === 'ru') {
    voice = findVoiceByLang(['ru-RU', 'ru']);
  } else {
    voice = findVoiceByLang(['en-US', 'en-GB', 'en']);
  }
  cachedPicks.set(locale, voice);
  return voice;
}
