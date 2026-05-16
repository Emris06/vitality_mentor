import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request as undiciRequest } from 'undici';
import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@vitality/shared';
import type { AiHintResponse, ScenarioId } from '@vitality/shared';
import { config } from '../config';
import { getOrCreateUserId } from '../lib/session';
import {
  getRunner,
  isImplemented,
  NotImplementedScenarioError,
} from '../sim/scenarios/index';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnknownStepError,
} from '../sim/engine';
import { publishHrEvent } from '../hr/events';
import { publishGameEvent } from '../gamification/events';

const SCENARIO_IDS = ['kyc', 'open-account', 'deposit', 'transfer'] as const;

const startRunSchema = z.object({
  scenarioId: z.enum(SCENARIO_IDS),
  locale: z.enum(SUPPORTED_LOCALES),
});

const runIdSchema = z.object({
  id: z.string().uuid(),
});

const submitStepSchema = z.object({
  stepId: z.string().min(1).max(64),
  payload: z.unknown(),
});

const hintSchema = z.object({
  stepId: z.string().min(1).max(64),
  contextOverride: z.record(z.string(), z.unknown()).optional(),
});

function mapEngineError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof NotFoundError) return { status: 404, body: { error: 'not_found' } };
  if (err instanceof ForbiddenError) return { status: 403, body: { error: 'forbidden' } };
  if (err instanceof ConflictError) return { status: 409, body: { error: 'conflict', detail: err.message } };
  if (err instanceof UnknownStepError) return { status: 400, body: { error: 'unknown_step', detail: err.message } };
  if (err instanceof NotImplementedScenarioError) {
    return { status: 501, body: { error: 'not_implemented', scenarioId: err.scenarioId } };
  }
  return { status: 500, body: { error: 'internal_error' } };
}

export async function simRoutes(app: FastifyInstance): Promise<void> {
  // ---- POST /sim/runs : start a new run ------------------------------------
  app.post('/sim/runs', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { scenarioId, locale } = parsed.data;
    const userId = getOrCreateUserId(req, reply);

    if (!isImplemented(scenarioId as ScenarioId)) {
      return reply.status(501).send({ error: 'not_implemented', scenarioId });
    }

    try {
      const runner = getRunner(scenarioId as ScenarioId);
      const run = await runner.start(userId, locale);
      return reply.status(201).send(run);
    } catch (err) {
      const mapped = mapEngineError(err);
      if (mapped.status >= 500) req.log.error({ err }, 'sim start failed');
      return reply.status(mapped.status).send(mapped.body);
    }
  });

  // ---- GET /sim/runs/:id : fetch a run -------------------------------------
  app.get('/sim/runs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = runIdSchema.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_run_id' });
    const userId = getOrCreateUserId(req, reply);

    // We don't know the scenarioId until we read the row, but every runner
    // shares the same DB schema, so we can dispatch via the kyc runner
    // safely for the read — getRun only touches the `scenario_runs` table.
    // Still, to keep the engine cleanly per-scenario we look up the row
    // through any registered runner (kyc is always there).
    try {
      const runner = getRunner('kyc');
      const run = await runner.getRun(parsed.data.id, userId);
      return reply.send(run);
    } catch (err) {
      const mapped = mapEngineError(err);
      if (mapped.status >= 500) req.log.error({ err }, 'sim get failed');
      return reply.status(mapped.status).send(mapped.body);
    }
  });

  // ---- POST /sim/runs/:id/steps : submit a step ----------------------------
  app.post('/sim/runs/:id/steps', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = runIdSchema.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_run_id' });
    const bodyParsed = submitStepSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: bodyParsed.error.flatten() });
    }
    const userId = getOrCreateUserId(req, reply);

    try {
      // Need scenarioId from the row to pick the right runner.
      const peekRunner = getRunner('kyc');
      const peek = await peekRunner.getRun(paramsParsed.data.id, userId);
      const runner = getRunner(peek.scenarioId);
      const result = await runner.submitStep(
        paramsParsed.data.id,
        userId,
        bodyParsed.data.stepId,
        bodyParsed.data.payload,
      );
      // Fan out a `hr.scored` event so the HR dashboard updates live whenever
      // a newcomer finishes a simulator run. We use the run's userId as the
      // newcomerId — the seeder wires those to match employee ids; for real
      // sessions HR will simply not see the event surface a known newcomer.
      if (result.run.status === 'scored' && typeof result.run.score === 'number') {
        void publishHrEvent({
          type: 'hr.scored',
          payload: {
            newcomerId: userId,
            runId: result.run.id,
            score: result.run.score,
            scenarioId: result.run.scenarioId,
          },
        });
        void publishGameEvent({
          type: 'sim.scored',
          userId,
          scenarioId: result.run.scenarioId,
          runId: result.run.id,
          score: result.run.score,
          mistakes: (result.run.mistakes ?? []).map((m) => ({
            stepId: m.stepId, code: m.code, penalty: m.penalty,
          })),
        });
      }
      return reply.send(result);
    } catch (err) {
      const mapped = mapEngineError(err);
      if (mapped.status >= 500) req.log.error({ err }, 'sim submit failed');
      return reply.status(mapped.status).send(mapped.body);
    }
  });

  // ---- POST /sim/runs/:id/hint : proxy to AI service /sim/hint -------------
  app.post('/sim/runs/:id/hint', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = runIdSchema.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_run_id' });
    const bodyParsed = hintSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: bodyParsed.error.flatten() });
    }
    const userId = getOrCreateUserId(req, reply);

    // Authorise + load context from the run state.
    let runScenario: ScenarioId;
    let runLocale: string;
    let context: Record<string, unknown>;
    try {
      const runner = getRunner('kyc'); // any runner can read the row
      const run = await runner.getRun(paramsParsed.data.id, userId);
      runScenario = run.scenarioId;
      runLocale = run.locale;
      const stateRunner = getRunner(runScenario);
      const state = await stateRunner.getState(paramsParsed.data.id, userId);
      context = bodyParsed.data.contextOverride
        ? { ...(state as Record<string, unknown>), ...bodyParsed.data.contextOverride }
        : (state as Record<string, unknown>);
    } catch (err) {
      const mapped = mapEngineError(err);
      if (mapped.status >= 500) req.log.error({ err }, 'sim hint preload failed');
      return reply.status(mapped.status).send(mapped.body);
    }

    const aiBody = {
      runId: paramsParsed.data.id,
      stepId: bodyParsed.data.stepId,
      locale: runLocale,
      scenarioId: runScenario,
      context,
    };

    try {
      const upstream = await undiciRequest(`${config.AI_SERVICE_URL}/sim/hint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(aiBody),
        headersTimeout: 30_000,
        bodyTimeout: 30_000,
      });
      const text = await upstream.body.text();
      if (upstream.statusCode >= 400) {
        req.log.error({ status: upstream.statusCode, text }, 'ai /sim/hint returned error');
        return reply.status(502).send({ error: 'ai_error', upstreamStatus: upstream.statusCode });
      }
      let parsed: AiHintResponse;
      try {
        parsed = JSON.parse(text) as AiHintResponse;
      } catch (err) {
        req.log.error({ err, text }, 'ai /sim/hint returned non-JSON');
        return reply.status(502).send({ error: 'ai_bad_response' });
      }
      return reply.send(parsed);
    } catch (err) {
      req.log.error({ err }, 'ai /sim/hint unreachable or timed out');
      return reply.status(502).send({ error: 'ai_unreachable' });
    }
  });
}
