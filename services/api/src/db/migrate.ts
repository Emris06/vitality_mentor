import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sql } from '../plugins/db';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface MigrateLogger {
  info: (msg: string) => void;
  error: (err: unknown, msg?: string) => void;
}

const defaultLogger: MigrateLogger = {
  info: (msg) => console.log(`[migrate] ${msg}`),
  error: (err, msg) => console.error(`[migrate] ${msg ?? 'error'}`, err),
};

/**
 * Apply all .sql files in migrations/ in lexical order, exactly once.
 * Idempotent: already-applied migrations (tracked in _migrations) are skipped.
 */
export async function migrate(logger: MigrateLogger = defaultLogger): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const entries = await readdir(MIGRATIONS_DIR);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();

  const appliedRows = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
  const applied = new Set(appliedRows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const fullPath = join(MIGRATIONS_DIR, file);
    const contents = await readFile(fullPath, 'utf8');
    logger.info(`applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });
    logger.info(`applied  ${file}`);
  }

  logger.info(`up to date (${files.length} migration${files.length === 1 ? '' : 's'} on disk)`);
}

// CLI entry: `tsx src/db/migrate.ts`
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
  migrate()
    .then(async () => {
      await sql.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async (err) => {
      defaultLogger.error(err, 'migration failed');
      await sql.end({ timeout: 5 }).catch(() => undefined);
      process.exit(1);
    });
}
