import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@vitality/shared';
import { MessageBubble } from './MessageBubble';
import { Thinking } from './Thinking';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const last = messages[messages.length - 1];
  const lastAssistantEmpty =
    streaming && last?.role === 'assistant' && last.content.length === 0;

  // Auto-scroll to bottom when content changes, but only if user is already
  // near the bottom — don't yank them away if they scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, lastAssistantEmpty]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      aria-live="polite"
      aria-relevant="additions text"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {lastAssistantEmpty && (
          <div className="flex w-full justify-start">
            <Thinking />
          </div>
        )}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}
