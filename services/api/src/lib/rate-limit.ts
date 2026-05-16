import { redis, ensureRedis } from '../plugins/redis';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const KEY_PREFIX = 'ratelimit:chat:';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
  remaining: number;
  limit: number;
}

/**
 * Redis-backed sliding window rate limiter.
 *
 * Implementation: per-user sorted set of request timestamps. On each call we
 * drop entries older than the window, count what's left, and (if under the
 * cap) record the current request. The set is given a TTL slightly longer
 * than the window so idle users don't accumulate dead keys.
 *
 * At most 20 chat requests / minute per user_id.
 */
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  await ensureRedis();

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const key = KEY_PREFIX + userId;
  // Score = ms timestamp. Member must be unique within the window — append a
  // suffix in case two requests land in the same millisecond.
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;

  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now, member);
  pipeline.pexpire(key, WINDOW_MS * 2);
  const results = await pipeline.exec();

  // exec() returns null only if the transaction was discarded; treat as fail-open
  // so a transient Redis blip doesn't break chat for everyone.
  if (!results) {
    return { allowed: true, remaining: MAX_REQUESTS - 1, limit: MAX_REQUESTS };
  }

  // results[1] = [err, count_before_insert]
  const card = results[1];
  const countBefore = typeof card?.[1] === 'number' ? card[1] : Number(card?.[1] ?? 0);
  const countAfter = countBefore + 1;

  if (countAfter > MAX_REQUESTS) {
    // Roll back the addition so we don't count denied requests against the user.
    await redis.zrem(key, member);

    // Oldest surviving timestamp tells us when the user can try again.
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    let retryAfterSec = Math.ceil(WINDOW_MS / 1000);
    if (oldest.length >= 2) {
      const oldestScore = Number(oldest[1]);
      if (Number.isFinite(oldestScore)) {
        const msUntilFree = oldestScore + WINDOW_MS - now;
        retryAfterSec = Math.max(1, Math.ceil(msUntilFree / 1000));
      }
    }
    return { allowed: false, retryAfterSec, remaining: 0, limit: MAX_REQUESTS };
  }

  return {
    allowed: true,
    remaining: Math.max(0, MAX_REQUESTS - countAfter),
    limit: MAX_REQUESTS,
  };
}
