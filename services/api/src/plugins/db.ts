import postgres from 'postgres';
import { config } from '../config';

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
