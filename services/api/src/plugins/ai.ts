import { request } from 'undici';
import { config } from '../config';

export async function pingAi(): Promise<{ latencyMs: number; detail?: string }> {
  const start = performance.now();
  const res = await request(`${config.AI_SERVICE_URL}/health`, {
    method: 'GET',
    headersTimeout: 1500,
    bodyTimeout: 1500,
  });
  const latencyMs = performance.now() - start;
  if (res.statusCode !== 200) {
    return { latencyMs, detail: `ai status ${res.statusCode}` };
  }
  return { latencyMs };
}
