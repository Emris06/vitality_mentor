import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import { config } from './config';
import { healthRoutes } from './routes/health';
import { chatRoutes } from './routes/chat';
import { simRoutes } from './routes/sim';
import { hrRoutes } from './routes/hr';
import { hrStreamRoutes } from './routes/hr_stream';
import { gamificationRoutes } from './routes/gamification';
import { skillsRoutes } from './routes/skills';
import { lmsRoutes } from './routes/lms';
import { clickyRoutes } from './routes/clicky';
import { pingDb } from './plugins/db';
import { requestIdPlugin } from './plugins/request-id';
import { jwtPlugin } from './plugins/jwt';
import { migrate } from './db/migrate';
import { runWorker as runGameWorker, requestStop as stopGameWorker } from './gamification/worker';
import { IspringClient } from './integrations/ispring/client';
import { IspringExportQueue } from './integrations/ispring/queue';
import {
  runLmsEventConsumer,
  requestStop as stopLmsConsumer,
} from './integrations/ispring/consumer';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.API_LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  await app.register(sensible);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  // Correlation id — must run before routes so every request log carries
  // requestId and the response echoes X-Request-Id.
  await app.register(requestIdPlugin);
  // JWT verification — populates `request.user` from a Bearer Supabase token
  // when present. Routes that need auth call `requireAuth(req)` themselves.
  await app.register(jwtPlugin);
  await app.register(healthRoutes);
  await app.register(chatRoutes, { prefix: '/' });
  await app.register(simRoutes, { prefix: '/' });
  await app.register(hrRoutes, { prefix: '/' });
  await app.register(hrStreamRoutes, { prefix: '/' });
  await app.register(gamificationRoutes, { prefix: '/' });
  await app.register(skillsRoutes, { prefix: '/' });
  await app.register(lmsRoutes, { prefix: '/' });
  await app.register(clickyRoutes, { prefix: '/' });

  app.get('/', async () => ({ service: 'vitality-api', ok: true }));

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Apply pending migrations before workers touch tables (lms_exports, etc.).
  if (config.NODE_ENV === 'development') {
    try {
      await pingDb();
      await migrate({
        info: (msg) => app.log.info(msg),
        error: (err, msg) => app.log.error({ err }, msg ?? 'migration error'),
      });
    } catch (err) {
      app.log.error({ err }, 'startup migration failed — workers may error until db:migrate:once');
    }
  }

  // Embedded game-event worker. Keeps the Ideathon demo to a single process
  // — Redis Streams give us at-least-once delivery without spinning up a
  // second container. Flip GAME_WORKER_EMBEDDED=false to run the worker
  // standalone via `tsx src/gamification/worker.ts`.
  if (config.GAME_WORKER_EMBEDDED !== 'false') {
    runGameWorker().catch((err) =>
      app.log.error({ err }, 'embedded game worker crashed'),
    );
    const onSignal = (): void => stopGameWorker();
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
  }

  // Embedded iSpring LMS pipeline. The export queue drains lms_exports; the
  // event consumer is a second group on the gamification stream that
  // enqueues rows into that table. Both default-on for the Ideathon demo so
  // a single `pnpm dev` covers the end-to-end flow.
  const ispringClient = new IspringClient({
    baseUrl: config.ISPRING_BASE_URL,
    apiKey: config.ISPRING_API_KEY,
  });
  const lmsQueue = new IspringExportQueue(ispringClient);

  if (config.LMS_WORKER_EMBEDDED !== 'false') {
    lmsQueue.runWorker().catch((err) =>
      app.log.error({ err }, 'embedded lms export queue crashed'),
    );
    const onSignal = (): void => lmsQueue.requestStop();
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
  }

  if (config.LMS_CONSUMER_EMBEDDED !== 'false') {
    runLmsEventConsumer(lmsQueue).catch((err) =>
      app.log.error({ err }, 'embedded lms event consumer crashed'),
    );
    const onSignal = (): void => stopLmsConsumer();
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
  }
}

main();
