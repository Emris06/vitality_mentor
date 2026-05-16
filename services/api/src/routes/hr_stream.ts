import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config';
import { HR_EVENTS_CHANNEL } from '../hr/events';

/**
 * Server-Sent Events bridge from Redis pub/sub to HR dashboard clients.
 *
 * One subscriber Redis connection per SSE client (ioredis enters "subscriber
 * mode" exclusively, so we cannot share the shared `redis` instance — that
 * one is in pub/normal-command mode). The connection is torn down when the
 * browser disconnects.
 *
 * Heartbeat every 25s so proxies (nginx, cloud LBs) don't reap an "idle"
 * stream; SSE comments (`:` prefix) are ignored by the client EventSource.
 *
 * TODO(auth): also gate this on an HR role once auth lands.
 */

const HEARTBEAT_MS = 25_000;

export async function hrStreamRoutes(app: FastifyInstance): Promise<void> {
  app.get('/hr/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    // Take over the raw socket — Fastify won't send a JSON body for us.
    reply.hijack();
    const raw = reply.raw;

    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    });
    // Initial comment flushes headers and primes the EventSource.
    raw.write(': connected\n\n');

    const sub = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      sub.disconnect();
      try {
        raw.end();
      } catch {
        /* socket already gone */
      }
    };

    const heartbeat = setInterval(() => {
      if (closed) return;
      try {
        raw.write(': ping\n\n');
      } catch {
        cleanup();
      }
    }, HEARTBEAT_MS);

    sub.on('message', (_channel, message) => {
      if (closed) return;
      // Validate it's parseable JSON — if not, skip it rather than crashing
      // the stream. Frontend expects clean JSON in `data:`.
      try {
        JSON.parse(message);
      } catch {
        return;
      }
      try {
        raw.write(`data: ${message}\n\n`);
      } catch {
        cleanup();
      }
    });

    sub.on('error', (err) => {
      req.log.error({ err }, 'hr stream redis error');
      // Don't tear down on transient errors; ioredis will reconnect.
    });

    try {
      await sub.connect();
      await sub.subscribe(HR_EVENTS_CHANNEL);
    } catch (err) {
      req.log.error({ err }, 'hr stream subscribe failed');
      cleanup();
      return;
    }

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);
  });
}
