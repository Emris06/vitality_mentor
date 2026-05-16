/**
 * Second consumer of the gamification stream — feeds the iSpring export queue.
 *
 * The gamification worker already consumes `vitality:game:stream` under group
 * `vitality-game`. Redis Streams allow multiple groups on the same stream
 * with independent cursors, so we add `vitality-lms` here and process every
 * event a *second* time (for export to iSpring).
 *
 * For each batched event:
 *   - `sim.scored`        → map → enqueue (kind=sim_scored)
 *   - `module.completed`  → map → enqueue (kind=module_completed)
 *   - anything else       → ignored (still acked)
 *
 * Ack semantics: we ack on successful enqueue (insert-or-noop). If enqueue
 * throws we let the whole batch be redelivered. Duplicates are safe because
 * idempotency_key has a UNIQUE constraint.
 */

import { consumeGameEvents, type ConsumedEvent } from '../../gamification/events';
import { mapModuleCompletedToResult, mapSimScoredToResult } from './map';
import type { IspringExportQueue } from './queue';

const GROUP = 'vitality-lms';
const CONSUMER = `lms-${process.pid}`;

let stopRequested = false;

export function requestStop(): void {
  stopRequested = true;
}

export async function runLmsEventConsumer(queue: IspringExportQueue): Promise<void> {
  installSignalHandlers();

  const onBatch = async (batch: ConsumedEvent[]): Promise<void> => {
    for (const { event } of batch) {
      try {
        if (event.type === 'sim.scored') {
          const input = mapSimScoredToResult(event);
          await queue.enqueue({
            kind: 'sim_scored',
            sourceId: event.runId,
            userId: event.userId,
            input,
          });
        } else if (event.type === 'module.completed') {
          const input = mapModuleCompletedToResult(event);
          await queue.enqueue({
            kind: 'module_completed',
            sourceId: event.moduleId,
            userId: event.userId,
            input,
          });
        }
        // Unknown / chat.solved events: nothing to export to iSpring. Falling
        // through here means we'll ack them (good — don't redeliver forever).
      } catch (err) {
        // Rethrow → events.ts leaves the batch unacked → redelivered next poll.
        // The UNIQUE idempotency_key makes the retry safe.
        throw err;
      }
    }
  };

  await consumeGameEvents(GROUP, CONSUMER, onBatch, {
    stopped: () => stopRequested,
    blockMs: 5000,
    count: 32,
  });
}

function installSignalHandlers(): void {
  const handler = (): void => {
    stopRequested = true;
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}
