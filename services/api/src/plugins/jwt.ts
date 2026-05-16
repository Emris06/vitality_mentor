import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';
import { config } from '../config';

export type UserRole = 'hr' | 'employee' | 'intern' | 'admin';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole | null;
  fullName: string | null;
  source: 'jwt' | 'cookie';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: { role?: UserRole; full_name?: string; [k: string]: unknown };
  app_metadata?: { role?: UserRole; [k: string]: unknown };
}

let secretCache: Uint8Array | null = null;
function getSecret(): Uint8Array | null {
  if (secretCache) return secretCache;
  if (!config.SUPABASE_JWT_SECRET) return null;
  secretCache = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
  return secretCache;
}

function extractBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function verifyJwt(token: string): Promise<AuthenticatedUser | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      // Supabase JWTs use the project URL as issuer; we don't enforce audience
      // because Supabase rotates it between auth-vN releases.
    });
    const p = payload as unknown as SupabaseJwtPayload;
    const role =
      (p.app_metadata?.role as UserRole | undefined) ??
      (p.user_metadata?.role as UserRole | undefined) ??
      null;
    return {
      id: p.sub,
      email: p.email ?? null,
      role,
      fullName: (p.user_metadata?.full_name as string | undefined) ?? null,
      source: 'jwt',
    };
  } catch {
    return null;
  }
}

/**
 * Registers the JWT plugin. Attaches `request.user` for every request:
 *   - Bearer token → verified Supabase user
 *   - else null (the per-route handler falls back to the cookie helper
 *     `getOrCreateUserId` when running in development).
 *
 * Intentionally does NOT block unauthenticated requests — public routes like
 * /health still need to work. Per-route guards enforce auth when required.
 */
export async function jwtPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    const token = extractBearer(req);
    if (!token) {
      req.user = null;
      return;
    }
    const verified = await verifyJwt(token);
    req.user = verified;
    if (verified) {
      req.log.debug({ userId: verified.id, role: verified.role }, 'auth.jwt.verified');
    }
  });
}

/**
 * Route guard helper. Use inside a route handler to reject if the request
 * is not authenticated, or to enforce one of the listed roles.
 */
export function requireAuth(
  req: FastifyRequest,
  opts: { roles?: UserRole[] } = {},
): AuthenticatedUser {
  if (!req.user) {
    const err = new Error('unauthorized') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }
  if (opts.roles && req.user.role && !opts.roles.includes(req.user.role)) {
    const err = new Error('forbidden') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return req.user;
}
