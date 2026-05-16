import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, Citation, Locale } from '@vitality/shared';
import { ChatHttpError, streamChat } from '../../lib/api';

export type ChatErrorCode = 'rate_limited' | 'generic';

export interface UseChatStream {
  messages: ChatMessage[];
  streaming: boolean;
  error: ChatErrorCode | null;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

function isCitation(value: unknown): value is Citation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.chunkId === 'string' &&
    typeof v.sourceDoc === 'string' &&
    typeof v.snippet === 'string' &&
    typeof v.lang === 'string'
  );
}

export function useChatStream(sessionId: string, locale: Locale): UseChatStream {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;

      // Cancel any previous stream and start a fresh one.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        locale,
        createdAt: now(),
      };
      const assistantId = newId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        citations: [],
        locale,
        createdAt: now(),
      };

      setError(null);
      setStreaming(true);
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const appendToken = (token: string) => {
        if (!mountedRef.current) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
        );
      };

      const appendCitation = (c: Citation) => {
        if (!mountedRef.current) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const list = m.citations ?? [];
            if (list.some((existing) => existing.chunkId === c.chunkId)) return m;
            return { ...m, citations: [...list, c] };
          }),
        );
      };

      const run = async () => {
        try {
          for await (const ev of streamChat(
            { sessionId, locale, message: trimmed },
            ctrl.signal,
          )) {
            if (!mountedRef.current) return;
            switch (ev.type) {
              case 'token': {
                const tok =
                  typeof ev.data === 'string'
                    ? ev.data
                    : (ev.data as { token?: string } | null)?.token ?? '';
                if (tok) appendToken(tok);
                break;
              }
              case 'citation': {
                if (isCitation(ev.data)) appendCitation(ev.data);
                break;
              }
              case 'meta':
                // Reserved for future use (e.g. routing info, model name).
                break;
              case 'error': {
                const msg = ((ev.data as { message?: string } | null)?.message ?? '').toLowerCase();
                if (mountedRef.current) {
                  setError(msg.includes('rate') ? 'rate_limited' : 'generic');
                }
                break;
              }
              case 'done':
              default:
                break;
            }
          }
        } catch (err) {
          if ((err as { name?: string }).name === 'AbortError') return;
          if (!mountedRef.current) return;
          if (err instanceof ChatHttpError && err.status === 429) {
            setError('rate_limited');
          } else {
            setError('generic');
          }
        } finally {
          if (mountedRef.current && abortRef.current === ctrl) {
            setStreaming(false);
          }
        }
      };

      void run();
    },
    [sessionId, locale],
  );

  return { messages, streaming, error, send, stop, reset };
}
