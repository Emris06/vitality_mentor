import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request as undiciRequest } from 'undici';
import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@vitality/shared';
import type { ChatMessage, ChatRequest, Citation, Locale } from '@vitality/shared';
import { config } from '../config';
import { sql } from '../plugins/db';
import { getOrCreateUserId } from '../lib/session';
import { checkChatRateLimit } from '../lib/rate-limit';

// Mirror of ChatRequest from @vitality/shared/types/chat.ts. Keep in sync.
const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  message: z.string().min(1).max(8000),
}) satisfies z.ZodType<ChatRequest>;

interface ChatSessionRow {
  id: string;
  user_id: string;
  locale: Locale;
  created_at: Date;
}

interface ChatMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[] | null;
  created_at: Date;
}

const DEFAULT_LOCALE: Locale = 'ru';

async function ensureSession(
  sessionId: string,
  userId: string,
  locale: Locale,
): Promise<ChatSessionRow> {
  const existing = await sql<ChatSessionRow[]>`
    SELECT id, user_id, locale, created_at
    FROM chat_sessions
    WHERE id = ${sessionId}
    LIMIT 1
  `;
  const first = existing[0];
  if (first) {
    if (first.user_id !== userId) {
      // Caller passed a sessionId that belongs to someone else.
      const err = new Error('session belongs to another user') as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }
    return first;
  }

  const inserted = await sql<ChatSessionRow[]>`
    INSERT INTO chat_sessions (id, user_id, locale)
    VALUES (${sessionId}, ${userId}, ${locale})
    ON CONFLICT (id) DO UPDATE SET locale = chat_sessions.locale
    RETURNING id, user_id, locale, created_at
  `;
  const row = inserted[0];
  if (!row) throw new Error('failed to create chat session');
  return row;
}

async function insertMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  citations: Citation[],
): Promise<void> {
  await sql`
    INSERT INTO chat_messages (session_id, role, content, citations)
    VALUES (${sessionId}, ${role}, ${content}, ${sql.json(citations as unknown as object)})
  `;
}

/**
 * Parse a single SSE event block ("event: foo\ndata: {...}\n\n" style) and
 * pull out (event, data) so we can accumulate the assistant message server-side
 * while still streaming the raw bytes through to the browser.
 */
function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

interface AccumulatedAssistant {
  text: string;
  citations: Citation[];
  done: boolean;
  errored: boolean;
}

/**
 * Consume one SSE event and update the running assistant message.
 * Mirrors the ChatStreamEvent contract from @vitality/shared.
 */
function applyStreamEvent(acc: AccumulatedAssistant, event: string, data: string): void {
  if (event === 'done') {
    acc.done = true;
    return;
  }
  if (event === 'error') {
    acc.errored = true;
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Token events sometimes ship raw text; treat as a plain string token.
    if (event === 'token' || event === 'message') acc.text += data;
    return;
  }

  // Shape from shared: { type, data }. Some upstreams may send the inner
  // payload directly under an event: line — handle both.
  const envelope = parsed as { type?: string; data?: unknown };
  const innerType = envelope?.type ?? event;
  const innerData = envelope?.data !== undefined ? envelope.data : parsed;

  switch (innerType) {
    case 'token': {
      if (typeof innerData === 'string') {
        acc.text += innerData;
      } else if (innerData && typeof innerData === 'object' && 'text' in innerData) {
        const t = (innerData as { text?: unknown }).text;
        if (typeof t === 'string') acc.text += t;
      }
      break;
    }
    case 'citation': {
      if (Array.isArray(innerData)) {
        acc.citations.push(...(innerData as Citation[]));
      } else if (innerData && typeof innerData === 'object') {
        acc.citations.push(innerData as Citation);
      }
      break;
    }
    case 'done':
      acc.done = true;
      break;
    case 'error':
      acc.errored = true;
      break;
    case 'meta':
    default:
      // Ignore — meta is pass-through only.
      break;
  }
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const userId = getOrCreateUserId(req, reply);

    const rl = await checkChatRateLimit(userId);
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfterSec ?? 60));
      reply.header('X-RateLimit-Limit', String(rl.limit));
      reply.header('X-RateLimit-Remaining', '0');
      return reply.status(429).send({
        error: 'rate_limited',
        retryAfterSec: rl.retryAfterSec ?? 60,
      });
    }
    reply.header('X-RateLimit-Limit', String(rl.limit));
    reply.header('X-RateLimit-Remaining', String(rl.remaining));

    let session: ChatSessionRow;
    try {
      session = await ensureSession(body.sessionId, userId, body.locale ?? DEFAULT_LOCALE);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      req.log.error({ err }, 'failed to ensure chat session');
      return reply.status(status).send({ error: 'session_error', message: (err as Error).message });
    }

    // Persist the user's turn before we hit the AI service so we don't lose it
    // if the upstream call fails partway through.
    try {
      await insertMessage(session.id, 'user', body.message, []);
    } catch (err) {
      req.log.error({ err }, 'failed to persist user message');
      return reply.status(500).send({ error: 'persist_failed' });
    }

    // Open the upstream SSE connection BEFORE we commit the response so we can
    // still return a normal JSON error if the AI service is down.
    let upstream: Awaited<ReturnType<typeof undiciRequest>>;
    try {
      upstream = await undiciRequest(`${config.AI_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          // Forward the correlation id so the AI service can stamp it on its
          // own log lines and we can stitch traces across the two processes.
          'x-request-id': req.id,
        },
        body: JSON.stringify(body),
        bodyTimeout: 30_000,
        headersTimeout: 30_000,
      });
    } catch (err) {
      req.log.error({ err }, 'ai service unreachable');
      return reply.status(502).send({ error: 'ai_unreachable' });
    }

    if (upstream.statusCode >= 400) {
      const text = await upstream.body.text().catch(() => '');
      req.log.error({ status: upstream.statusCode, text }, 'ai service returned error');
      return reply.status(502).send({
        error: 'ai_error',
        upstreamStatus: upstream.statusCode,
      });
    }

    // From here on we are committing to an SSE response.
    reply.raw.statusCode = 200;
    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    // Flush headers so the browser opens the EventSource before the first chunk.
    if (typeof reply.raw.flushHeaders === 'function') reply.raw.flushHeaders();
    reply.hijack();

    const acc: AccumulatedAssistant = { text: '', citations: [], done: false, errored: false };
    let leftover = '';
    const decoder = new TextDecoder('utf-8');

    // If the client disconnects mid-stream we still want to abort the upstream.
    const onClose = (): void => {
      try {
        upstream.body.destroy();
      } catch {
        /* swallow */
      }
    };
    req.raw.once('close', onClose);

    try {
      for await (const chunk of upstream.body) {
        const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk as Uint8Array);
        // 1. Pass bytes through to the client untouched.
        if (!reply.raw.writableEnded) {
          reply.raw.write(buf);
        }
        // 2. Accumulate server-side for persistence.
        leftover += decoder.decode(buf, { stream: true });
        let sepIdx: number;
        while ((sepIdx = leftover.indexOf('\n\n')) !== -1) {
          const block = leftover.slice(0, sepIdx);
          leftover = leftover.slice(sepIdx + 2);
          const evt = parseSseBlock(block);
          if (evt) applyStreamEvent(acc, evt.event, evt.data);
        }
      }
      // Flush any trailing partial block.
      leftover += decoder.decode();
      if (leftover.trim().length > 0) {
        const evt = parseSseBlock(leftover);
        if (evt) applyStreamEvent(acc, evt.event, evt.data);
      }
    } catch (err) {
      req.log.error({ err }, 'error while streaming chat from ai service');
      acc.errored = true;
    } finally {
      req.raw.off('close', onClose);
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    }

    // Persist the assistant message even if the stream ended without an
    // explicit `done` event, as long as we got some content.
    if (!acc.errored && acc.text.length > 0) {
      try {
        await insertMessage(session.id, 'assistant', acc.text, acc.citations);
      } catch (err) {
        req.log.error({ err }, 'failed to persist assistant message');
      }
    }
  });

  app.get<{ Params: { sessionId: string } }>(
    '/chat/sessions/:sessionId/messages',
    async (req, reply) => {
      const paramsSchema = z.object({ sessionId: z.string().uuid() });
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_session_id' });
      }
      const { sessionId } = parsed.data;
      const userId = getOrCreateUserId(req, reply);

      const sessions = await sql<ChatSessionRow[]>`
        SELECT id, user_id, locale, created_at
        FROM chat_sessions
        WHERE id = ${sessionId}
        LIMIT 1
      `;
      const session = sessions[0];
      if (!session) return reply.status(404).send({ error: 'session_not_found' });
      if (session.user_id !== userId) return reply.status(404).send({ error: 'session_not_found' });

      const rows = await sql<ChatMessageRow[]>`
        SELECT id, role, content, citations, created_at
        FROM chat_messages
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC, id ASC
      `;

      const messages: ChatMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        citations: Array.isArray(r.citations) ? r.citations : [],
        locale: session.locale,
        createdAt: r.created_at.toISOString(),
      }));

      return messages;
    },
  );
}
