import { applyGameEvent } from './apply';
import { consumeGameEvents, type ConsumedEvent } from './events';

/**
 * Long-running game-event worker. Pulls batches off the Redis Stream, applies
 * each event to the gamification state (idempotently), and acks the batch.
 *
 * Deployment modes:
 *   - **Embedded** (default for Ideathon): server.ts kicks this off in the
 *     background after `app.listen`. One process, one consumer.
 *   - **Standalone**: `tsx src/gamification/worker.ts` from services/api/.
 *     Lets you horizontally scale by running multiple workers in the same
 *     consumer group; XREADGROUP guarantees each message lands at exactly
 *     one consumer in the group.
 *
 * Graceful shutdown: SIGTERM / SIGINT flip a stop flag; the consume loop's
 * BLOCK call returns within ~5s and the function resolves.
 */

const GROUP = 'vitality-game';
const CONSUMER = `worker-${process.pid}`;

let stopRequested = false;

export function requestStop(): void {
  stopRequested = true;
}

export async function runWorker(): Promise<void> {
  installSignalHandlers();

  const onBatch = async (batch: ConsumedEvent[]): Promise<void> => {
    // Process serially within a batch. Most events touch the same user rows
    // so parallelising would just thrash Postgres for no real gain at our
    // scale; if a single event throws, we let the whole batch retry on the
    // next poll (the unacked ids stay in the PEL).
    for (const { event } of batch) {
      try {
        await applyGameEvent(event);
      } catch (err) {
        // TODO(observability): once we wire pino into worker.ts, log here
        // instead of rethrowing — currently the throw bubbles to events.ts
        // which swallows it and leaves all batch ids unacked.
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
  const handler = (sig: NodeJS.Signals): void => {
    // Don't exit the process here — server.ts may be running. Just request
    // stop; the embedded caller will await us.
    stopRequested = true;
    // Standalone mode: re-raising is fine, the OS will reap us after the
    // worker finishes. We rely on Node's default behaviour for that.
    void sig;
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}

// CLI entry: `tsx src/gamification/worker.ts`
import { fileURLToPath } from 'node:url';
const isCli = (() => {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return fileURLToPath(import.meta.url) === arg;
  } catch {
    return false;
  }
})();

if (isCli) {
  runWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[game-worker] crashed', err);
      process.exit(1);
    });
}
