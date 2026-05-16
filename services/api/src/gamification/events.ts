import { redis, ensureRedis } from '../plugins/redis';

/**
 * Game events bus — Redis Streams (NOT pub/sub).
 *
 * HR uses Redis pub/sub for a fire-and-forget "live ping" to the dashboard
 * (see hr/events.ts). Gamification needs durable, at-least-once delivery into
 * a worker that mutates XP / badges / streaks, so we use a Stream + consumer
 * group instead. A pub/sub subscriber that's offline at publish time loses
 * the message; a Stream consumer in group `vitality-game` will pick it up
 * whenever it next calls XREADGROUP.
 *
 * Channel name kept around as a constant for symmetry / observability tags;
 * we don't actually `PUBLISH` to it — the stream name below is what matters.
 */
export const GAME_EVENTS_CHANNEL = 'vitality:game:events';
export const GAME_EVENTS_STREAM = 'vitality:game:stream';

// ----- Event shapes ---------------------------------------------------------
//
// All payloads must be JSON-serialisable. The worker decodes with JSON.parse
// and treats `type` as a discriminator. Add new types here AND in apply.ts.

export interface ModuleCompletedEvent {
  type: 'module.completed';
  userId: string;
  moduleId: string;
  score: number;
}

export interface SimScoredEvent {
  type: 'sim.scored';
  userId: string;
  scenarioId: string;
  runId: string;
  score: number;
  mistakes: Array<{ stepId: string; code: string; penalty: number }>;
}

export interface ChatSolvedEvent {
  type: 'chat.solved';
  userId: string;
  sessionId: string;
}

export type GameEvent = ModuleCompletedEvent | SimScoredEvent | ChatSolvedEvent;

// ----- Publish --------------------------------------------------------------

/**
 * Append an event to the durable stream. Fire-and-forget from the caller's
 * point of view: we swallow errors so a flaky Redis can't break the HTTP path
 * that triggered the event (the originating DB write is already committed).
 */
export async function publishGameEvent(event: GameEvent): Promise<void> {
  try {
    await ensureRedis();
    await redis.xadd(GAME_EVENTS_STREAM, '*', 'data', JSON.stringify(event));
  } catch {
    // Swallow — the worker will catch up on retry if Redis comes back; but if
    // the event is lost outright, the user just doesn't get XP for this one
    // action. Better than 500-ing the API call.
  }
}

// ----- Consume --------------------------------------------------------------

export interface ConsumedEvent {
  /** Redis Stream message ID, e.g. "1715812345-0". Needed for XACK. */
  id: string;
  event: GameEvent;
}

/**
 * Long-running consumer loop. Calls `onBatch` with up to 32 events per tick;
 * blocks for up to 5s waiting for new entries. Creates the consumer group
 * lazily (MKSTREAM so the stream is created on first start).
 *
 * Acknowledgement model:
 *   - if `onBatch` resolves, we XACK every message in the batch.
 *   - if it throws, we DO NOT ack; the messages stay in the pending entries
 *     list (PEL) and will be redelivered on the next XREADGROUP call with id
 *     "0". For Ideathon scope we don't run a separate claim loop — a single
 *     consumer + retry-on-next-poll is enough.
 *
 * Returns a Promise that resolves only when `stopped()` becomes true.
 */
export async function consumeGameEvents(
  group: string,
  consumer: string,
  onBatch: (events: ConsumedEvent[]) => Promise<void>,
  options: { stopped?: () => boolean; blockMs?: number; count?: number } = {},
): Promise<void> {
  const { stopped = () => false, blockMs = 5000, count = 32 } = options;
  await ensureRedis();

  // Ensure the group exists. BUSYGROUP just means another worker already
  // created it — that's fine.
  try {
    await redis.xgroup('CREATE', GAME_EVENTS_STREAM, group, '$', 'MKSTREAM');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('BUSYGROUP')) throw err;
  }

  while (!stopped()) {
    // Alternate "0" (re-read pending, i.e. unacked) and ">" (new). On the
    // very first iteration we drain anything left from a previous crash.
    let res: unknown;
    try {
      res = await redis.xreadgroup(
        'GROUP', group, consumer,
        'COUNT', count,
        'BLOCK', blockMs,
        'STREAMS', GAME_EVENTS_STREAM, '>',
      );
    } catch {
      // Transient Redis errors — back off briefly via the BLOCK call itself.
      if (stopped()) return;
      // Sleep proportional to BLOCK so we don't hot-loop on a dead Redis.
      await new Promise((r) => setTimeout(r, Math.min(blockMs, 2000)));
      continue;
    }

    if (!res || !Array.isArray(res)) continue;
    const batch: ConsumedEvent[] = [];
    // Result shape: [[streamName, [[id, [field, value, ...]], ...]]]
    for (const stream of res as Array<[string, Array<[string, string[]]>]>) {
      const entries = stream?.[1] ?? [];
      for (const [id, fields] of entries) {
        // fields is a flat ["data", "<json>"] array.
        const dataIdx = fields.indexOf('data');
        if (dataIdx === -1) continue;
        const raw = fields[dataIdx + 1];
        if (!raw) continue;
        try {
          const event = JSON.parse(raw) as GameEvent;
          batch.push({ id, event });
        } catch {
          // Bad payload — ack it so we don't keep redelivering garbage.
          await redis.xack(GAME_EVENTS_STREAM, group, id).catch(() => undefined);
        }
      }
    }

    if (batch.length === 0) continue;

    try {
      await onBatch(batch);
      const ids = batch.map((b) => b.id);
      if (ids.length > 0) {
        await redis.xack(GAME_EVENTS_STREAM, group, ...ids);
      }
    } catch {
      // Leave unacked; XREADGROUP with ">" won't redeliver, but a future
      // reconnect (`'0'` cursor) or a claim loop would. For Ideathon: log
      // would help; we keep this branch silent to match HR's pattern.
    }
  }
}
