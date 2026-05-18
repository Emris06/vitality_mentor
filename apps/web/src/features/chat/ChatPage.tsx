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
import { InternShell } from '../workspace/InternShell';
import { buildMentoraNav } from '../workspace/mentoraNav';
import { WarmCard } from '../../components/warm/WarmCard';

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

// ──────────────────────────────────────────────────────────────────────────
// `/chat` page — warm theme (Phase F).
//
// Behavior preserved bit-identical from the prior ErpShell version:
//   - useChatStream(sessionId, locale) — every SSE event type intact
//   - localStorage keys `vitality.chatSessionId` + `vitality.voice.autoSpeak`
//   - useAutoSpeakAssistant TTS cancellation on send + on unmount
//   - useSpeechRecognition wiring through ChatInput
// Only the visual shell + bubble + input styling change.
// ──────────────────────────────────────────────────────────────────────────

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

  const handleSampleClick = useCallback(
    (q: string) => {
      setDraft('');
      autoSpeak.cancelAll();
      send(q);
    },
    [send, autoSpeak],
  );

  const empty = messages.length === 0;
  const roleLabel =
    profile?.role === 'hr'
      ? t('auth.role_hr_name')
      : profile?.role === 'intern'
        ? t('auth.role_intern_name')
        : t('auth.role_employee_name');
  const userName = profile?.fullName ?? 'Team Member';
  const firstName = userName.split(/\s+/)[0] ?? userName;

  return (
    <InternShell
      userName={userName}
      userRole={roleLabel}
      greeting={t('intern.shell.greeting', { name: firstName })}
      pageTitle={t('chat.title')}
      navItems={buildMentoraNav(profile?.role ?? null)}
      rightPanel={<ChatHelperRail t={t} voiceMode={voiceMode} ttsSupported={ttsSupported} onToggleVoice={() => setVoiceMode((v) => !v)} />}
    >
      <WarmCard className="flex min-h-[720px] flex-col overflow-hidden p-0">
        {empty ? (
          <EmptyState onPick={handleSampleClick} />
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
            <div className="mb-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
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
      </WarmCard>
    </InternShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Right rail
// ──────────────────────────────────────────────────────────────────────────

interface HelperProps {
  t: (key: string) => string;
  voiceMode: boolean;
  ttsSupported: boolean;
  onToggleVoice: () => void;
}

function ChatHelperRail({ t, voiceMode, ttsSupported, onToggleVoice }: HelperProps) {
  return (
    <div className="space-y-5">
      <WarmCard className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('chat.helper.voice_title')}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--ink-warm-2)]">
          {t('chat.helper.voice_body')}
        </p>
        <div className="mt-3">
          <VoiceModeToggle
            enabled={voiceMode}
            supported={ttsSupported}
            onToggle={onToggleVoice}
          />
        </div>
      </WarmCard>

      <WarmCard className="p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">
          {t('chat.helper.tips_title')}
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--ink-warm-2)]">
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-mentora-600" />
            {t('chat.helper.tip_citations')}
          </li>
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-coral-600" />
            {t('chat.helper.tip_languages')}
          </li>
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            {t('chat.helper.tip_synthetic')}
          </li>
        </ul>
      </WarmCard>
    </div>
  );
}
