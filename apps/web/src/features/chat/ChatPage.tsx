import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
// `/chat` page — warm theme (Phase F) / floating panel (Phase 7).
//
// Behavior preserved bit-identical from the prior ErpShell version:
//   - useChatStream(sessionId, locale) — every SSE event type intact
//   - localStorage keys `vitality.chatSessionId` + `vitality.voice.autoSpeak`
//   - useAutoSpeakAssistant TTS cancellation on send + on unmount
//   - useSpeechRecognition wiring through ChatInput
//
// Two rendering modes:
//   - `page`  (default) → full InternShell layout at `/chat`
//   - `panel`           → floating right-bottom panel (.chat-panel) launched
//                         from the in-shell FAB. All hooks identical.
// ──────────────────────────────────────────────────────────────────────────

interface ChatPageProps {
  mode?: 'page' | 'panel';
  onClose?: () => void;
}

export function ChatPage({ mode = 'page', onClose }: ChatPageProps = {}) {
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

  // ── Panel mode — floating right-bottom widget mounted by InternShell ────
  if (mode === 'panel') {
    return (
      <div className="chat-panel" role="dialog" aria-label={t('chat.title')}>
        <div className="chat-hd">
          <span className="pulse" aria-hidden="true" />
          <div>
            <b>{t('chat.title')}</b>
            <small>RAG · {t('chat.helper.tip_synthetic')}</small>
          </div>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label={t('chat.stop')}
            data-clicky-target="close, dismiss, hide, chat, panel"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="chat-body">
          {empty ? (
            <EmptyState onPick={handleSampleClick} />
          ) : (
            <MessageList messages={messages} streaming={streaming} />
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              style={{
                margin: '0 4px 4px',
                background: 'var(--bad-tint)',
                border: '1px solid rgba(200,53,28,0.2)',
                borderRadius: 'var(--r-md)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--bad)',
              }}
            >
              {error === 'rate_limited' ? t('chat.error_rate_limited') : t('chat.error_generic')}
            </motion.div>
          )}
        </div>

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
    );
  }

  // ── Page mode — full InternShell layout at /chat ────────────────────────
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
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          minHeight: 720,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            <div
              style={{
                marginBottom: 8,
                background: 'var(--bad-tint)',
                border: '1px solid rgba(200,53,28,0.2)',
                borderRadius: 'var(--r-md)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--bad)',
              }}
            >
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
    </InternShell>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16 }}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Right rail (page mode only)
// ──────────────────────────────────────────────────────────────────────────

interface HelperProps {
  t: (key: string) => string;
  voiceMode: boolean;
  ttsSupported: boolean;
  onToggleVoice: () => void;
}

const RAIL_CARD: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)',
  padding: 18,
};

function ChatHelperRail({ t, voiceMode, ttsSupported, onToggleVoice }: HelperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={RAIL_CARD}>
        <h3 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', margin: '0 0 8px', fontWeight: 500 }}>
          {t('chat.helper.voice_title')}
        </h3>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--mute)', margin: '0 0 12px' }}>
          {t('chat.helper.voice_body')}
        </p>
        <VoiceModeToggle
          enabled={voiceMode}
          supported={ttsSupported}
          onToggle={onToggleVoice}
        />
      </div>

      <div style={RAIL_CARD}>
        <h3 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', margin: '0 0 12px', fontWeight: 500 }}>
          {t('chat.helper.tips_title')}
        </h3>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'chat.helper.tip_citations', color: 'var(--cobalt)' },
            { key: 'chat.helper.tip_languages', color: 'var(--synth)' },
            { key: 'chat.helper.tip_synthetic', color: 'var(--good)' },
          ].map(({ key, color }) => (
            <li key={key} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--mute)', lineHeight: 1.5 }}>
              <span style={{ marginTop: 5, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
