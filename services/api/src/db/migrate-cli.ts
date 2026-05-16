/**
 * One-shot migration CLI for cloud deploys.
 *
 * The API server auto-applies migrations only when `NODE_ENV=development`
 * (see services/api/src/server.ts). In production we want migrations to run
 * exactly once, manually, after Railway provisions the DATABASE_URL — not
 * on every container restart (which would race a multi-replica deploy and
 * could re-run partially-applied DDL on a flaky DB).
 *
 * Usage on Railway (one-off shell or `railway run`):
 *
 *   pnpm db:migrate:once
 *
 * Exit codes:
 *   0 — all pending migrations applied (or nothing to do)
 *   1 — migration failed; the migration is rolled back inside its tx
 *
 * This file deliberately mirrors the CLI block in `migrate.ts` so it can be
 * invoked from a package.json script without relying on `import.meta` path
 * tricks that don't survive a bundled build.
 */
import { migrate } from './migrate';
import { sql } from '../plugins/db';

async function main(): Promise<void> {
  try {
    await migrate();
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (err) {
    console.error('[migrate-cli] migration failed', err);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  }
}

main();
