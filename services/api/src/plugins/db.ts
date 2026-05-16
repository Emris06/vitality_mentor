import postgres from 'postgres';
import type { JSONValue } from 'postgres';
import { config } from '../config';

/** Cast a runtime value for `sql.json()` / `tx.json()` (postgres.js JSONValue). */
export function asJson(value: unknown): JSONValue {
  return value as JSONValue;
}

export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 5,
});

export async function pingDb(): Promise<number> {
  const start = performance.now();
  await sql`SELECT 1`;
  return performance.now() - start;
}
