/**
 * iSpring export queue — drains `lms_exports` and POSTs to iSpring.
 *
 * Design choices:
 *   - Postgres-backed (no Redis-only queue) because we want a durable audit
 *     trail HR can introspect at /lms/exports. The Redis stream is upstream of
 *     this; once a row lands here it's the queue's job to deliver, retry, or
 *     bury in dead_letter.
 *   - `SELECT ... FOR UPDATE SKIP LOCKED` so we can horizontally scale the
 *     worker later without dual delivery (each row goes to exactly one
 *     drainer at a time).
 *   - Backoff: `next_eligible_at = created_at + min(2^attempts * 30s, 30min)`.
 *     For Ideathon we anchor on created_at (not last attempt) which keeps the
 *     SQL trivial — close enough at 6 max attempts. attempts==0 → eligible
 *     immediately (delay clamps to 30s but pending rows have attempts=0, so
 *     the only time this matters is `failed` rows).
 *   - Dead-letter at 6 attempts. The /lms/exports/:id/retry route resets
 *     attempts to 0 and flips back to pending.
 *
 * The worker is intentionally trivial: pull a batch, await each submitResult,
 * update the row. We don't parallelise — at Ideathon scale that just adds
 * failure modes without buying anything.
 */

import { asJson, sql } from '../../plugins/db';
import { IspringClient, IspringError } from './client';
import type { SubmitResultInput } from './types';

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 20;
const BASE_BACKOFF_SECONDS = 30;
const MAX_BACKOFF_SECONDS = 30 * 60;

export type LmsExportKind = 'sim_scored' | 'module_completed' | 'assessment';
export type LmsExportStatus = 'pending' | 'submitted' | 'failed' | 'dead_letter';

export interface EnqueueInput {
  kind: LmsExportKind;
  sourceId: string;
  userId: string;
  /** The payload we'll send to iSpring. Idempotency-Key is derived from input.idempotencyKey. */
  input: SubmitResultInput;
}

export interface EnqueueResult {
  enqueued: boolean;
  exportId: string;
}

export class IspringExportQueue {
  private readonly client: IspringClient;
  private stopRequested = false;
  private runningLoop: Promise<void> | null = null;

  constructor(client: IspringClient) {
    this.client = client;
  }

  /**
   * INSERT a new row keyed by idempotency_key. On conflict the existing row
   * id is returned so the caller can still log/observe — but `enqueued`
   * accurately reflects whether this call actually added anything.
   */
  async enqueue(item: EnqueueInput): Promise<EnqueueResult> {
    const rows = await sql<Array<{ id: string; inserted: boolean }>>`
      WITH ins AS (
        INSERT INTO lms_exports (kind, source_id, user_id, payload, idempotency_key)
        VALUES (
          ${item.kind},
          ${item.sourceId},
          ${item.userId},
          ${sql.json(asJson(item.input))},
          ${item.input.idempotencyKey}
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id, true AS inserted
      )
      SELECT id, inserted FROM ins
      UNION ALL
      SELECT id, false AS inserted
        FROM lms_exports
       WHERE idempotency_key = ${item.input.idempotencyKey}
         AND NOT EXISTS (SELECT 1 FROM ins)
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      // Should not happen — the SELECT branch always finds the existing row.
      throw new Error('enqueue: no row returned');
    }
    return { enqueued: row.inserted, exportId: row.id };
  }

  /**
   * Pull up to BATCH_SIZE eligible rows, submit each, and update status.
   * Returns the number of rows processed (success + failure both count).
   */
  async drainOnce(): Promise<number> {
    // One transaction per batch so SKIP LOCKED actually serialises us against
    // concurrent drainers. We update rows in-place inside the same tx.
    return await sql.begin(async (tx) => {
      // Backoff:
      //   attempts == 0 → eligible immediately (the row was just enqueued)
      //   attempts >= 1 → updated_at + min(2^attempts * 30s, 30min) <= now()
      // We anchor failed-retries on updated_at (the last attempt's timestamp)
      // not created_at, so a row that's been bouncing doesn't get re-tried
      // faster just because it's been around longer.
      const candidates = await tx<Array<{
        id: string;
        payload: SubmitResultInput;
        attempts: number;
      }>>`
        SELECT id, payload, attempts
          FROM lms_exports
         WHERE status IN ('pending','failed')
           AND (
             attempts = 0
             OR updated_at + (
               LEAST(
                 POWER(2, attempts) * ${BASE_BACKOFF_SECONDS},
                 ${MAX_BACKOFF_SECONDS}
               ) * interval '1 second'
             ) <= now()
           )
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT ${BATCH_SIZE}
      `;
      if (candidates.length === 0) return 0;

      for (const row of candidates) {
        try {
          const result = await this.client.submitResult(row.payload);
          await tx`
            UPDATE lms_exports
               SET status = 'submitted',
                   attempts = attempts + 1,
                   ispring_result_id = ${result.id},
                   last_error = NULL,
                   updated_at = now()
             WHERE id = ${row.id}
          `;
        } catch (err) {
          const nextAttempts = row.attempts + 1;
          const terminal = nextAttempts >= MAX_ATTEMPTS;
          const message =
            err instanceof IspringError
              ? `iSpring ${err.status}: ${safeBodyPreview(err.body)}`
              : err instanceof Error
                ? err.message
                : String(err);
          await tx`
            UPDATE lms_exports
               SET status = ${terminal ? 'dead_letter' : 'failed'},
                   attempts = ${nextAttempts},
                   last_error = ${message},
                   updated_at = now()
             WHERE id = ${row.id}
          `;
        }
      }
      return candidates.length;
    });
  }

  /**
   * Run the drain loop until requestStop() is called. Polls every
   * `intervalMs` when there's nothing to do; immediately polls again if the
   * last drain returned a full batch (probably more waiting).
   */
  async runWorker(intervalMs = 2000): Promise<void> {
    if (this.runningLoop) return this.runningLoop;
    this.runningLoop = (async () => {
      while (!this.stopRequested) {
        let processed = 0;
        try {
          processed = await this.drainOnce();
        } catch (err) {
          // Transient DB error: log via console (no app.log in scope here)
          // and back off the usual interval before retrying.
          // eslint-disable-next-line no-console
          console.error('[lms-queue] drainOnce failed', err);
        }
        if (this.stopRequested) break;
        if (processed >= BATCH_SIZE) continue; // Probably more — loop hot.
        await sleepInterruptible(intervalMs, () => this.stopRequested);
      }
    })();
    return this.runningLoop;
  }

  requestStop(): void {
    this.stopRequested = true;
  }
}

function safeBodyPreview(body: unknown): string {
  if (body == null) return '';
  const s = typeof body === 'string' ? body : (() => {
    try { return JSON.stringify(body); } catch { return String(body); }
  })();
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}

function sleepInterruptible(ms: number, stopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const step = 200;
    let elapsed = 0;
    const tick = (): void => {
      if (stopped() || elapsed >= ms) return resolve();
      elapsed += step;
      setTimeout(tick, Math.min(step, ms - elapsed + step));
    };
    tick();
  });
}
