/**
 * /lms/* — HR-facing visibility & control over iSpring exports.
 *
 * TODO(auth): every handler here is anonymous. The dashboard surface is
 *             HR-only; gate behind a role claim before any non-Ideathon
 *             deploy. `/lms/exports/:id/retry` is especially sensitive — an
 *             unauth'd user could trash backoff windows.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { sql } from '../plugins/db';
import { redis, ensureRedis } from '../plugins/redis';
import { IspringClient } from '../integrations/ispring/client';
import type { IspringCourse } from '../integrations/ispring/types';

const COURSES_CACHE_KEY = 'lms:courses:v1';
const COURSES_CACHE_TTL_SECONDS = 300;

const listQuery = z.object({
  status: z.enum(['pending', 'submitted', 'failed', 'dead_letter']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParam = z.object({ id: z.string().uuid() });

export async function lmsRoutes(app: FastifyInstance): Promise<void> {
  const client = new IspringClient({
    baseUrl: config.ISPRING_BASE_URL,
    apiKey: config.ISPRING_API_KEY,
  });

  // GET /lms/courses — 5min Redis cache. iSpring's course list is effectively
  // static for a demo; we don't want to hammer it from the HR dashboard.
  app.get('/lms/courses', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await ensureRedis();
      const cached = await redis.get(COURSES_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as IspringCourse[];
          return reply.send({ courses: parsed, cached: true });
        } catch {
          // Fall through to refetch on bad cache content.
        }
      }
    } catch (err) {
      req.log.warn({ err }, 'lms courses cache lookup failed');
    }

    try {
      const courses = await client.listCourses();
      // Fire-and-forget cache write.
      redis
        .set(COURSES_CACHE_KEY, JSON.stringify(courses), 'EX', COURSES_CACHE_TTL_SECONDS)
        .catch((err) => req.log.warn({ err }, 'lms courses cache write failed'));
      return reply.send({ courses, cached: false });
    } catch (err) {
      req.log.error({ err }, 'lms courses upstream failed');
      return reply.status(502).send({ error: 'ispring_unreachable' });
    }
  });

  // GET /lms/exports?status=&limit=&offset= — paginated list joined with employees.
  app.get('/lms/exports', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { status, limit, offset } = parsed.data;

    const rows = status
      ? await sql<Array<ExportRow>>`
          SELECT e.id, e.kind, e.source_id, e.user_id, emp.full_name AS user_name,
                 e.status, e.attempts, e.last_error, e.ispring_result_id,
                 e.idempotency_key, e.created_at, e.updated_at
            FROM lms_exports e
            LEFT JOIN employees emp ON emp.id = e.user_id
           WHERE e.status = ${status}
           ORDER BY e.created_at DESC
           LIMIT ${limit} OFFSET ${offset}
        `
      : await sql<Array<ExportRow>>`
          SELECT e.id, e.kind, e.source_id, e.user_id, emp.full_name AS user_name,
                 e.status, e.attempts, e.last_error, e.ispring_result_id,
                 e.idempotency_key, e.created_at, e.updated_at
            FROM lms_exports e
            LEFT JOIN employees emp ON emp.id = e.user_id
           ORDER BY e.created_at DESC
           LIMIT ${limit} OFFSET ${offset}
        `;

    return reply.send({ exports: rows, limit, offset });
  });

  // POST /lms/exports/:id/retry — flip back to pending, zero attempts.
  // TODO(auth): HR-only.
  app.post('/lms/exports/:id/retry', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_id' });

    const updated = await sql<Array<{ id: string }>>`
      UPDATE lms_exports
         SET status = 'pending',
             attempts = 0,
             last_error = NULL,
             updated_at = now()
       WHERE id = ${parsed.data.id}
         AND status IN ('failed','dead_letter','submitted')
       RETURNING id
    `;
    if (updated.length === 0) {
      return reply.status(404).send({ error: 'not_found_or_not_retryable' });
    }
    return reply.send({ ok: true, id: updated[0]!.id });
  });

  // GET /lms/health — 1s probe of iSpring /_health.
  app.get('/lms/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = await client.health(1000);
    return reply.send(result);
  });
}

interface ExportRow {
  id: string;
  kind: string;
  source_id: string;
  user_id: string;
  user_name: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  ispring_result_id: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}
