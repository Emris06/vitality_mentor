/**
 * Skills Analysis Platform — REST surface (Track 3).
 *
 * All endpoints are zod-validated. The handlers are thin: business logic
 * lives in skills/service.ts; AI calls live in skills/ai.ts.
 *
 * TODO(auth): every handler here is currently anonymous. The dashboard is
 *             intended for HR / managers; gate behind a role claim before
 *             any non-Ideathon deploy.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SkillForecast } from '@vitality/shared';
import { isLocale, type Locale } from '@vitality/shared';
import {
  cacheForecast,
  getCachedForecast,
  getEmployee,
  getPromotionReadiness,
  getSkillGaps,
  getSkillHistory,
  getSkillProfile,
  getTaxonomy,
  getTeamAnalytics,
  getTeamGapMatrix,
  getTrainingModules,
} from '../skills/service';
import { aiForecastSkill, aiRecommendModules } from '../skills/ai';

// ----- zod schemas ----------------------------------------------------------

const idParam = z.object({ id: z.string().uuid() });

const TARGET_ROLES = ['senior_compliance', 'senior_operations'] as const;
const targetRoleQuery = z.object({ targetRole: z.enum(TARGET_ROLES) });

const recommendationsQuery = z.object({
  targetRole: z.enum(TARGET_ROLES),
  locale: z.string().optional(),
});

const forecastQuery = z.object({
  skillId: z.string().trim().min(1).max(64),
  horizonDays: z.coerce.number().int().min(1).max(180).default(30),
});

const teamFiltersQuery = z.object({
  department: z.string().trim().min(1).max(120).optional(),
  targetRole: z.enum(TARGET_ROLES).optional(),
});

const analyticsQuery = z.object({
  department: z.string().trim().min(1).max(120).optional(),
});

// ----- routes ---------------------------------------------------------------

export async function skillsRoutes(app: FastifyInstance): Promise<void> {
  // GET /skills/taxonomy ----------------------------------------------------
  app.get('/skills/taxonomy', async (_req: FastifyRequest, reply: FastifyReply) => {
    const nodes = await getTaxonomy();
    return reply.send({ nodes });
  });

  // GET /skills/employees/:id/profile --------------------------------------
  app.get('/skills/employees/:id/profile', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_id' });

    const employee = await getEmployee(parsed.data.id);
    if (!employee) return reply.status(404).send({ error: 'not_found' });

    const skills = await getSkillProfile(parsed.data.id);
    return reply.send({ employee, skills });
  });

  // GET /skills/employees/:id/gaps?targetRole=... --------------------------
  app.get('/skills/employees/:id/gaps', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParam.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const queryParsed = targetRoleQuery.safeParse(req.query);
    if (!queryParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: queryParsed.error.flatten() });
    }

    const gaps = await getSkillGaps(paramsParsed.data.id, queryParsed.data.targetRole);
    return reply.send({ gaps });
  });

  // GET /skills/employees/:id/readiness?targetRole=... ---------------------
  app.get('/skills/employees/:id/readiness', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParam.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const queryParsed = targetRoleQuery.safeParse(req.query);
    if (!queryParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: queryParsed.error.flatten() });
    }

    const readiness = await getPromotionReadiness(
      paramsParsed.data.id,
      queryParsed.data.targetRole,
    );
    return reply.send(readiness);
  });

  // GET /skills/employees/:id/recommendations?targetRole=&locale= ----------
  // Resolves AI module ids against the training_modules catalog. Unmatched
  // ids (e.g. fallback's "mod_<skill>_*") are expanded to the first matching
  // module for that skill so the UI always has something to show.
  app.get(
    '/skills/employees/:id/recommendations',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const paramsParsed = idParam.safeParse(req.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_id' });
      const queryParsed = recommendationsQuery.safeParse(req.query);
      if (!queryParsed.success) {
        return reply.status(400).send({ error: 'invalid_request', details: queryParsed.error.flatten() });
      }
      const employeeId = paramsParsed.data.id;
      const { targetRole } = queryParsed.data;
      const locale: Locale = queryParsed.data.locale && isLocale(queryParsed.data.locale)
        ? queryParsed.data.locale
        : 'ru';

      const [gaps, catalog] = await Promise.all([
        getSkillGaps(employeeId, targetRole),
        getTrainingModules(),
      ]);

      const ranked = await aiRecommendModules({ employeeId, gaps, locale });

      // Build lookup tables: by id, and by skill (for fallback wildcard ids).
      const byId = new Map<string, typeof catalog[number]>();
      const bySkill = new Map<string, typeof catalog[number][]>();
      for (const m of catalog) {
        byId.set(m.id, m);
        if (m.skillId) {
          const arr = bySkill.get(m.skillId) ?? [];
          arr.push(m);
          bySkill.set(m.skillId, arr);
        }
      }

      // Resolve each ranked entry; expand wildcards into the first 1-2 modules
      // for that skill. Skip anything we can't resolve at all.
      const emitted = new Set<string>();
      const out: Array<{
        moduleId: string;
        title: string | null;
        skillId: string | null;
        reason: string;
        impactScore: number;
        estimatedMinutes: number;
      }> = [];
      for (const r of ranked) {
        const wildcardMatch = /^mod_([a-z0-9_]+)_\*$/.exec(r.moduleId);
        const matches: typeof catalog = [];
        if (wildcardMatch) {
          const skillId = wildcardMatch[1]!;
          for (const m of (bySkill.get(skillId) ?? []).slice(0, 2)) matches.push(m);
        } else {
          const exact = byId.get(r.moduleId);
          if (exact) matches.push(exact);
        }
        for (const m of matches) {
          if (emitted.has(m.id)) continue;
          emitted.add(m.id);
          out.push({
            moduleId: m.id,
            title: m.titleKey,
            skillId: m.skillId,
            reason: r.reason,
            impactScore: r.impactScore,
            estimatedMinutes: m.estimatedMinutes,
          });
        }
      }

      return reply.send({ recommendations: out });
    },
  );

  // GET /skills/employees/:id/forecast?skillId=&horizonDays= ---------------
  app.get('/skills/employees/:id/forecast', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParam.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const queryParsed = forecastQuery.safeParse(req.query);
    if (!queryParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: queryParsed.error.flatten() });
    }
    const employeeId = paramsParsed.data.id;
    const { skillId, horizonDays } = queryParsed.data;

    // Cache hit (≤1h old) — return immediately.
    const cached = await getCachedForecast(employeeId, skillId, horizonDays);
    if (cached) return reply.send(cached);

    // Cache miss — fetch history, call AI (with TS-OLS fallback), then cache.
    const history = await getSkillHistory(employeeId, skillId, 30);
    let forecast: SkillForecast;
    try {
      forecast = await aiForecastSkill({ employeeId, skillId, history, horizonDays });
    } catch (err) {
      req.log.error({ err }, 'forecast generation failed');
      return reply.status(500).send({ error: 'forecast_failed' });
    }

    // Fire-and-forget cache write — errors here are non-fatal.
    cacheForecast(employeeId, skillId, horizonDays, forecast).catch((err) => {
      req.log.warn({ err }, 'forecast cache write failed');
    });

    return reply.send(forecast);
  });

  // GET /skills/team/gap-matrix?department=&targetRole= --------------------
  app.get('/skills/team/gap-matrix', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = teamFiltersQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const matrix = await getTeamGapMatrix(parsed.data);
    return reply.send(matrix);
  });

  // GET /skills/team/analytics?department= ---------------------------------
  app.get('/skills/team/analytics', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = analyticsQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const analytics = await getTeamAnalytics(parsed.data);
    return reply.send(analytics);
  });
}
