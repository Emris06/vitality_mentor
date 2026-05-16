import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { useChatStream } from './useChatStream';
import { VoiceModeToggle } from './voice/VoiceModeToggle';
import { useAutoSpeakAssistant } from './voice/useAutoSpeakAssistant';
import { isTtsSupported } from './voice/speechCapabilities';
import { useAuth } from '../auth/AuthProvider';
import { ErpShell } from '../workspace/ErpShell';
import { buildWorkspaceSections } from '../workspace/navigation';

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
  const { profile } = useAuth();
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
  const sections = useMemo(() => buildWorkspaceSections(), []);
  const roleLabel =
    profile?.role === 'hr'
      ? t('auth.role_hr_name')
      : profile?.role === 'intern'
        ? t('auth.role_intern_name')
        : t('auth.role_employee_name');

  return (
    <ErpShell
      title={t('chat.title')}
      subtitle={t('app.name')}
      userName={profile?.fullName ?? 'Team Member'}
      userRole={roleLabel}
      sections={sections}
      searchPlaceholder="Search messages, procedures, and prompts"
      topActions={
        <VoiceModeToggle
          enabled={voiceMode}
          supported={ttsSupported}
          onToggle={() => setVoiceMode((v) => !v)}
        />
      }
    >
      <div className="flex min-h-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
      </div>
    </ErpShell>
  );
}
