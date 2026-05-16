import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE_NAME = 'vitality.user';

// Loose UUID v4 shape check — we generated it, but cookies are user-controlled.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the current user id. JWT-first: if `request.user` was populated by
 * the JWT plugin from a Bearer Supabase token, use that subject. Otherwise
 * fall back to the dev-mode cookie pseudo-auth.
 *
 * The cookie path remains so that `pnpm dev` keeps working without Supabase
 * env vars set. In production, a missing `request.user` for a route that
 * truly requires identity should be rejected via `requireAuth()` instead of
 * reaching this helper.
 */
export function getOrCreateUserId(req: FastifyRequest, reply: FastifyReply): string {
  // Prefer the verified Supabase JWT subject when present.
  if (req.user && UUID_RE.test(req.user.id)) {
    return req.user.id;
  }

  const cookies = (req as FastifyRequest & { cookies?: Record<string, string | undefined> }).cookies ?? {};
  const existing = cookies[COOKIE_NAME];
  if (existing && UUID_RE.test(existing)) {
    return existing;
  }

  const userId = randomUUID();
  reply.setCookie(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // No expiry => session cookie persists until the browser is configured otherwise.
    // We deliberately don't set `secure: true` so dev over http://localhost works.
  });
  return userId;
}
