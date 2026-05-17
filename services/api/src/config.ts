import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().default(4000),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://vitality:vitality@localhost:5433/vitality'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  ISPRING_BASE_URL: z.string().default('http://localhost:4010'),
  ISPRING_API_KEY: z.string().default('dev-mock-key'),
  // When 'true' (default), the API process also runs the game-event worker
  // in-process. Set to 'false' in deployments where you run a dedicated
  // `tsx src/gamification/worker.ts` process.
  GAME_WORKER_EMBEDDED: z.enum(['true', 'false']).default('true'),
  // When 'true' (default), the API also runs the iSpring export queue
  // (drains lms_exports → POST /api/v1/results) in-process.
  LMS_WORKER_EMBEDDED: z.enum(['true', 'false']).default('true'),
  // When 'true' (default), the API also runs the LMS consumer that reads the
  // gamification stream under group `vitality-lms` and enqueues exports.
  LMS_CONSUMER_EMBEDDED: z.enum(['true', 'false']).default('true'),

  // Supabase auth — JWTs issued by Supabase are verified server-side using the
  // project's symmetric secret. Leave SUPABASE_JWT_SECRET unset to disable
  // JWT verification entirely (dev fallback to cookie-based session).
  SUPABASE_URL: z.string().default(''),
  SUPABASE_JWT_SECRET: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // Clicky voice agent. The route falls back to a local keyword matcher if
  // ANTHROPIC_API_KEY is missing or the upstream errors — so the demo still
  // runs without an API key, it just gets dumber.
  ANTHROPIC_API_KEY: z.string().default(''),
  CLICKY_MODEL: z.string().default('claude-haiku-4-5'),
  // Hard ceiling for the Clicky LLM call (ms). Frontend gives up after this
  // and falls back to local matching, so 1500 keeps us inside the 2 s budget.
  CLICKY_TIMEOUT_MS: z.coerce.number().int().default(1500),
});

export const config = schema.parse(process.env);
export type AppConfig = typeof config;
