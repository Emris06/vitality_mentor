/**
 * Mock iSpring REST server for the Vitality Ideathon demo.
 *
 * Implements just enough of iSpring's surface for the API's export pipeline:
 *   - GET  /api/v1/_health
 *   - GET  /api/v1/courses
 *   - POST /api/v1/enrollments
 *   - POST /api/v1/results        (Idempotency-Key required; replays return cached row)
 *   - GET  /api/v1/results/:id
 *
 * Chaos mode: set MOCK_FAIL_RATE in [0..1] to randomly 503 a fraction of
 * POST /api/v1/results calls. This is how we demo the export queue's retry/
 * backoff/dead-letter behaviour without touching the API itself.
 *
 * In-memory state: dies with the process. Good enough for a demo; if you
 * need to survive restarts, point this at SQLite later.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4010);
const HOST = process.env.HOST ?? '0.0.0.0';
const FAIL_RATE = clamp01(Number(process.env.MOCK_FAIL_RATE ?? '0'));

interface Course {
  id: string;
  title: string;
  durationMinutes: number;
}

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'failed';
}

interface Result {
  id: string;
  userId: string;
  courseId: string;
  score: number;
  passed: boolean;
  completedAt: string;
  metadata?: Record<string, unknown>;
}

const COURSES: Course[] = [
  { id: 'course.vit.kyc',           title: 'KYC Fundamentals',           durationMinutes: 45 },
  { id: 'course.vit.aml',           title: 'AML & Sanctions Screening',  durationMinutes: 60 },
  { id: 'course.vit.open_account',  title: 'Opening Customer Accounts',  durationMinutes: 40 },
  { id: 'course.vit.deposit',       title: 'Deposit Products',           durationMinutes: 30 },
  { id: 'course.vit.transfer',      title: 'Payments & Transfers',       durationMinutes: 50 },
  { id: 'course.vit.customer_service', title: 'Customer Service Basics', durationMinutes: 35 },
];

const enrollments: Enrollment[] = [];
const resultsById = new Map<string, Result>();
// idempotency-key → result id. Replays return the same row.
const resultsByIdempotencyKey = new Map<string, string>();

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cors, { origin: true });

  // ----- Health -----------------------------------------------------------
  app.get('/api/v1/_health', async () => ({ ok: true }));

  // ----- Courses ----------------------------------------------------------
  app.get('/api/v1/courses', async () => ({ courses: COURSES }));

  // ----- Enrollments ------------------------------------------------------
  app.post('/api/v1/enrollments', async (req, reply) => {
    const body = req.body as { userId?: unknown; courseId?: unknown } | null;
    if (!body || typeof body.userId !== 'string' || typeof body.courseId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    const row: Enrollment = {
      id: randomUUID(),
      userId: body.userId,
      courseId: body.courseId,
      status: 'enrolled',
    };
    enrollments.push(row);
    return reply.status(201).send(row);
  });

  // ----- Results (idempotent on header) -----------------------------------
  app.post('/api/v1/results', async (req, reply) => {
    const idemKey = req.headers['idempotency-key'];
    const key = Array.isArray(idemKey) ? idemKey[0] : idemKey;
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({ error: 'missing_idempotency_key' });
    }

    // Replay → return the previously-stored row, no chaos.
    const existingId = resultsByIdempotencyKey.get(key);
    if (existingId) {
      const existing = resultsById.get(existingId);
      if (existing) return reply.send(existing);
    }

    // Chaos: pretend iSpring is overloaded. Caller will retry on 503.
    if (FAIL_RATE > 0 && Math.random() < FAIL_RATE) {
      return reply.status(503).send({ error: 'upstream_unavailable', retryAfter: 5 });
    }

    const body = req.body as Partial<Result> | null;
    if (
      !body
      || typeof body.userId !== 'string'
      || typeof body.courseId !== 'string'
      || typeof body.score !== 'number'
      || typeof body.passed !== 'boolean'
      || typeof body.completedAt !== 'string'
    ) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const result: Result = {
      id: randomUUID(),
      userId: body.userId,
      courseId: body.courseId,
      score: body.score,
      passed: body.passed,
      completedAt: body.completedAt,
      ...(body.metadata && typeof body.metadata === 'object'
        ? { metadata: body.metadata as Record<string, unknown> }
        : {}),
    };
    resultsById.set(result.id, result);
    resultsByIdempotencyKey.set(key, result.id);
    return reply.status(201).send(result);
  });

  app.get<{ Params: { id: string } }>('/api/v1/results/:id', async (req, reply) => {
    const row = resultsById.get(req.params.id);
    if (!row) return reply.status(404).send({ error: 'not_found' });
    return reply.send(row);
  });

  await app.listen({ host: HOST, port: PORT });
  app.log.info(
    { port: PORT, failRate: FAIL_RATE, courses: COURSES.length },
    'vitality-ispring-mock ready',
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ispring-mock] failed to start', err);
  process.exit(1);
});
