import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

let connected = false;

export async function ensureRedis(): Promise<void> {
  if (connected) return;
  await redis.connect();
  connected = true;
}

export async function pingRedis(): Promise<number> {
  await ensureRedis();
  const start = performance.now();
  await redis.ping();
  return performance.now() - start;
}
