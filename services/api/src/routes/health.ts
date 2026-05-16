import type { FastifyInstance } from 'fastify';
import type { HealthCheck, HealthResponse } from '@vitality/shared';
import { pingDb } from '../plugins/db';
import { pingRedis } from '../plugins/redis';
import { pingAi } from '../plugins/ai';

async function safeCheck(name: string, fn: () => Promise<number | { latencyMs: number; detail?: string }>): Promise<HealthCheck> {
  try {
    const result = await fn();
    if (typeof result === 'number') return { name, status: 'ok', latencyMs: result };
    return { name, status: result.detail ? 'degraded' : 'ok', latencyMs: result.latencyMs, detail: result.detail };
  } catch (err) {
    return { name, status: 'down', detail: (err as Error).message };
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const checks = await Promise.all([
      safeCheck('postgres', pingDb),
      safeCheck('redis', pingRedis),
      safeCheck('ai', pingAi),
    ]);
    const worst = checks.reduce<HealthResponse['status']>((acc, c) => {
      if (c.status === 'down') return 'down';
      if (c.status === 'degraded' && acc !== 'down') return 'degraded';
      return acc;
    }, 'ok');
    const payload: HealthResponse = {
      status: worst,
      version: process.env.npm_package_version ?? '0.0.0',
      checks,
      timestamp: new Date().toISOString(),
    };
    return payload;
  });
}
