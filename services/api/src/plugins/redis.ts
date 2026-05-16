import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

let connected = false;
let connecting: Promise<void> | null = null;

export async function ensureRedis(): Promise<void> {
  if (connected) return;
  if (connecting) return connecting;
  connecting = redis
    .connect()
    .then(() => {
      connected = true;
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

export async function pingRedis(): Promise<number> {
  await ensureRedis();
  const start = performance.now();
  await redis.ping();
  return performance.now() - start;
}
