import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const HEADER = 'x-request-id';

/**
 * Request correlation plugin.
 *
 * - Reads X-Request-Id from the inbound request if present, else mints a
 *   fresh UUIDv4.
 * - Overrides Fastify's auto-generated request.id so it matches the value
 *   we'll echo back and log.
 * - Echoes the chosen id back on the response as X-Request-Id.
 * - Attaches `requestId` to every subsequent log line via a child logger.
 *
 * Why a plugin and not inline middleware: this lets us register it in the
 * exact slot we want (after CORS / cookie, before the route handlers) and
 * keeps the server.ts wiring noise-free.
 */
export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  // Tell Fastify to prefer our generator. This still runs first, so when the
  // header is absent we get a UUID; if the header is present, we replace it
  // in the onRequest hook below.
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers[HEADER];
    const fromHeader = Array.isArray(incoming) ? incoming[0] : incoming;
    const id = (fromHeader && fromHeader.trim()) || randomUUID();
    // request.id is read-only on the FastifyRequest type, but it's a plain
    // property under the hood. Cast to assign.
    (request as unknown as { id: string }).id = id;
    reply.header('x-request-id', id);
    request.log = request.log.child({ requestId: id });
  });
}
