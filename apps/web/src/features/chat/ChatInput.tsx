import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@vitality/shared';
import { LiveCaption } from './voice/LiveCaption';
import { MicButton } from './voice/MicButton';
import {
  useSpeechRecognition,
  type SttErrorKind,
} from './voice/useSpeechRecognition';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  onSendVoiceText?: (text: string) => void;
  onSttPermissionDenied?: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  {
    value,
    onChange,
    onSubmit,
    onStop,
    streaming,
    onSendVoiceText,
    onSttPermissionDenied,
  },
  ref,
) {
  const { t, i18n } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const locale: Locale = useMemo(() => {
    const resolved = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
    return isLocale(resolved) ? resolved : DEFAULT_LOCALE;
  }, [i18n.resolvedLanguage]);

  const [voiceError, setVoiceError] = useState<string | null>(null);

  const handleFinal = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Prefer the explicit voice-send callback so the parent's `send`
      // is invoked with the recognized text directly. This sidesteps a
      // race between setState and submit.
      if (onSendVoiceText) {
        onChange('');
        onSendVoiceText(trimmed);
      } else {
        onChange(trimmed);
        // Defer one tick so the textarea value is reflected before submit.
        window.setTimeout(() => onSubmit(), 0);
      }
    },
    [onChange, onSendVoiceText, onSubmit],
  );

  const handleSttError = useCallback(
    (kind: SttErrorKind) => {
      if (kind === 'no-speech') {
        // Silent failure — common, just stop.
        return;
      }
      if (kind === 'not-allowed') {
        setVoiceError(t('chat.voice.error_permission'));
        onSttPermissionDenied?.();
        return;
      }
      if (kind === 'unsupported') {
        const lang = t(`locale.${locale}`);
        setVoiceError(
          t('chat.voice.unsupported_for_locale', { locale: lang }),
        );
        return;
      }
      setVoiceError(t('chat.voice.error_generic'));
    },
    [locale, onSttPermissionDenied, t],
  );

  const stt = useSpeechRecognition({
    locale,
    onFinal: handleFinal,
    onError: handleSttError,
  });

  // Clear the voice error after a short delay so it doesn't linger forever.
  useEffect(() => {
    if (!voiceError) return;
    const id = window.setTimeout(() => setVoiceError(null), 4500);
    return () => window.clearTimeout(id);
  }, [voiceError]);

  // If locale changes mid-listen, stop. Hook also discards transcript internally.
  useEffect(() => {
    if (stt.listening) {
      stt.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
  }));

  // Autosize the textarea up to ~6 lines.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    if (streaming) return;
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onSubmit();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const handleMicToggle = () => {
    setVoiceError(null);
    if (stt.listening) {
      stt.stop();
    } else {
      stt.start();
    }
  };

  return (
    <form
      className="border-t border-ink-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <LiveCaption listening={stt.listening} transcript={stt.transcript} />
      {voiceError && (
        <div
          className="mx-auto w-full max-w-3xl px-4 md:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="mb-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            {voiceError}
          </div>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3 md:px-6">
        <label htmlFor="chat-input" className="sr-only">
          {t('chat.placeholder')}
        </label>
        <textarea
          id="chat-input"
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t('chat.placeholder')}
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500"
          aria-describedby="chat-input-hint"
        />
        <MicButton
          listening={stt.listening}
          supported={stt.supported}
          disabled={streaming}
          onToggle={handleMicToggle}
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full border border-ink-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 shadow-sm transition-colors hover:bg-ink-50"
          >
            {t('chat.stop')}
          </button>
        ) : (
          <button
            type="submit"
            disabled={value.trim().length === 0}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {t('chat.send')}
          </button>
        )}
      </div>
      <p
        id="chat-input-hint"
        className="mx-auto -mt-1 hidden w-full max-w-3xl px-6 pb-2 text-[11px] text-ink-500 md:block"
      >
        {t('chat.input_hint')}
      </p>
    </form>
  );
});
