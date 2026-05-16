import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, Locale } from '@vitality/shared';
import { useSpeechSynthesis } from './useSpeechSynthesis';

const MAX_TTS_CHARS = 800;

export interface UseAutoSpeakAssistantOpts {
  messages: ChatMessage[];
  streaming: boolean;
  voiceMode: boolean;
  locale: Locale;
}

export interface UseAutoSpeakAssistant {
  speaking: boolean;
  supported: boolean;
  cancelAll: () => void;
}

export function useAutoSpeakAssistant(
  opts: UseAutoSpeakAssistantOpts,
): UseAutoSpeakAssistant {
  const { messages, streaming, voiceMode, locale } = opts;
  const { t } = useTranslation();
  const { speak, cancel, speaking, supported } = useSpeechSynthesis(locale);
  const spokenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!voiceMode || !supported) return;
    if (streaming) return; // Wait until the assistant finishes.
    if (messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    const content = (last.content ?? '').trim();
    if (!content) return;
    if (spokenIdsRef.current.has(last.id)) return;

    spokenIdsRef.current.add(last.id);

    if (content.length > MAX_TTS_CHARS) {
      const head = content.slice(0, MAX_TTS_CHARS).trimEnd();
      const tail = t('chat.voice.truncated');
      speak(`${head}… ${tail}`);
    } else {
      speak(content);
    }
  }, [messages, streaming, voiceMode, supported, speak, t]);

  // If the user switches voice mode off, immediately silence playback.
  useEffect(() => {
    if (!voiceMode) cancel();
  }, [voiceMode, cancel]);

  return { speaking, supported, cancelAll: cancel };
}
