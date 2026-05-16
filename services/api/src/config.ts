import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().default(4000),
  API_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://vitality:vitality@localhost:5432/vitality'),
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
});

export const config = schema.parse(process.env);
export type AppConfig = typeof config;
