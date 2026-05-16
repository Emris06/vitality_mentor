import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { LocalePicker } from '../../components/LocalePicker';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { useChatStream } from './useChatStream';
import { VoiceModeToggle } from './voice/VoiceModeToggle';
import { useAutoSpeakAssistant } from './voice/useAutoSpeakAssistant';
import { isTtsSupported } from './voice/speechCapabilities';

const SESSION_KEY = 'vitality.chatSessionId';
const VOICE_MODE_KEY = 'vitality.voice.autoSpeak';

function readInitialVoiceMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VOICE_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function readOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function ChatPage() {
  const { t, i18n } = useTranslation();
  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const [sessionId] = useState<string>(() => readOrCreateSessionId());
  const { messages, streaming, error, send, stop } = useChatStream(sessionId, locale);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<ChatInputHandle | null>(null);

  const ttsSupported = isTtsSupported();
  const [voiceMode, setVoiceMode] = useState<boolean>(() =>
    ttsSupported ? readInitialVoiceMode() : false,
  );

  const autoSpeak = useAutoSpeakAssistant({
    messages,
    streaming,
    voiceMode,
    locale,
  });

  // Persist preference.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VOICE_MODE_KEY, voiceMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [voiceMode]);

  // Stop any in-flight TTS when navigating away from the chat page.
  useEffect(() => {
    return () => {
      autoSpeak.cancelAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    // Stop reading the previous answer the moment a new question is sent.
    autoSpeak.cancelAll();
    send(text);
  }, [draft, send, autoSpeak]);

  const handleVoiceSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      autoSpeak.cancelAll();
      send(trimmed);
    },
    [send, autoSpeak],
  );

  const handleSttPermissionDenied = useCallback(() => {
    // Auto-disable for the session so the toggle doesn't keep prompting.
    setVoiceMode(false);
  }, []);

  const handleSample = useCallback(
    (q: string) => {
      setDraft('');
      autoSpeak.cancelAll();
      send(q);
    },
    [send, autoSpeak],
  );

  const empty = messages.length === 0;

  return (
    <main className="flex h-full min-h-0 flex-col bg-gradient-to-b from-ink-50 to-white">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-9 w-9 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
              aria-label={t('chat.back')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                AI
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-ink-900">{t('chat.title')}</span>
                <span className="text-[11px] text-ink-500">{t('app.name')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VoiceModeToggle
              enabled={voiceMode}
              supported={ttsSupported}
              onToggle={() => setVoiceMode((v) => !v)}
            />
            <LocalePicker />
          </div>
        </div>
      </header>

      {empty ? (
        <EmptyState onPick={handleSample} />
      ) : (
        <MessageList messages={messages} streaming={streaming} />
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-3xl px-4 md:px-6"
          role="alert"
        >
          <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error === 'rate_limited' ? t('chat.error_rate_limited') : t('chat.error_generic')}
          </div>
        </motion.div>
      )}

      <ChatInput
        ref={inputRef}
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        onStop={stop}
        streaming={streaming}
        onSendVoiceText={handleVoiceSend}
        onSttPermissionDenied={handleSttPermissionDenied}
      />
    </main>
  );
}
