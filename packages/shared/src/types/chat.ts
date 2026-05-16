import type { Locale } from './locale';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface Citation {
  chunkId: string;
  sourceDoc: string;
  page?: number;
  snippet: string;
  lang: Locale;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  locale?: Locale;
  createdAt: string;
}

export interface ChatRequest {
  sessionId: string;
  locale?: Locale;
  message: string;
}

export interface ChatStreamEvent {
  type: 'token' | 'citation' | 'done' | 'error' | 'meta';
  data: unknown;
}
