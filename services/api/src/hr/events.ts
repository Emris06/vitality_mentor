import { redis, ensureRedis } from '../plugins/redis';

/**
 * Real-time HR event bus.
 *
 * All HR-facing live updates flow through a single Redis pub/sub channel.
 * Multiple API instances (when we scale horizontally) can each publish; the
 * SSE handler in hr_stream.ts fans messages out to connected browsers.
 *
 * Keep the event shape narrow and serialisable — the frontend treats this
 * as a discriminated union on `type`.
 */

export const HR_EVENTS_CHANNEL = 'vitality:hr:events';

export type HrEvent =
  | { type: 'hr.assigned'; payload: { assignmentId: string; mentorId: string; newcomerId: string } }
  | { type: 'hr.unassigned'; payload: { newcomerId: string; mentorId: string } }
  | { type: 'hr.progress'; payload: { newcomerId: string; modulesCompleted: number; modulesTotal: number } }
  | { type: 'hr.scored'; payload: { newcomerId: string; runId: string; score: number; scenarioId: string } };

/**
 * Fire-and-forget publisher. Never throws — a failed publish must not block
 * the originating HTTP request (the DB write is the source of truth; SSE is
 * just a UX nicety).
 */
export async function publishHrEvent(event: HrEvent): Promise<void> {
  try {
    await ensureRedis();
    await redis.publish(HR_EVENTS_CHANNEL, JSON.stringify(event));
  } catch {
    // Swallow: SSE clients will recover on the next event or via polling.
  }
}
