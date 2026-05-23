import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sql } from '../plugins/db';
import { getOrCreateUserId } from '../lib/session';

/**
 * Gamification REST surface.
 *
 * TODO(auth): every handler here is anonymous. /gamification/me reads the
 *             requester's cookie-derived user id; the other endpoints accept
 *             a userId path param with no role check. Gate behind HR / self
 *             auth before any non-Ideathon deploy.
 */

// ----- shared row + projection types ---------------------------------------

interface XpRow { skill: string; sum: string }

interface BadgeRow {
  id: string;
  name_key: string;
  description_key: string;
  icon: string | null;
  earned_at: Date;
}

interface QuestRow {
  id: string;
  name_key: string;
  description_key: string;
  kind: 'daily' | 'weekly' | 'onboarding';
  goal: Record<string, number>;
  reward_xp: number;
  progress: Record<string, number> | null;
  completed_at: Date | null;
}

interface StreakRow {
  current_days: number;
  longest_days: number;
  last_active_date: string | null;
}

interface ProfilePayload {
  userId: string;
  xpBySkill: Record<string, number>;
  badges: Array<{
    id: string; nameKey: string; descriptionKey: string; icon: string | null; earnedAt: string;
  }>;
  streak: { current: number; longest: number; lastActiveDate: string | null };
  todayQuest: {
    id: string; nameKey: string; descriptionKey: string;
    kind: 'daily' | 'weekly' | 'onboarding';
    goal: Record<string, number>; progress: Record<string, number>;
    rewardXp: number; completedAt: string | null;
  } | null;
}

async function loadProfile(userId: string): Promise<ProfilePayload> {
  const xpRows = await sql<XpRow[]>`
    SELECT skill, COALESCE(SUM(delta), 0)::text AS sum
    FROM xp_ledger
    WHERE user_id = ${userId}
    GROUP BY skill
  `;
  const xpBySkill: Record<string, number> = {};
  for (const r of xpRows) xpBySkill[r.skill] = Number(r.sum) || 0;

  const badgeRows = await sql<BadgeRow[]>`
    SELECT b.id, b.name_key, b.description_key, b.icon, ub.earned_at
    FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id
    WHERE ub.user_id = ${userId}
    ORDER BY ub.earned_at DESC
  `;

  const streakRows = await sql<StreakRow[]>`
    SELECT current_days, longest_days, last_active_date::text AS last_active_date
    FROM streaks WHERE user_id = ${userId} LIMIT 1
  `;
  const streak = streakRows[0] ?? { current_days: 0, longest_days: 0, last_active_date: null };

  // todayQuest: prefer an in-progress daily for today; fall back to any
  // incomplete onboarding quest.
  const questRows = await sql<QuestRow[]>`
    SELECT q.id, q.name_key, q.description_key, q.kind, q.goal, q.reward_xp,
           uq.progress, uq.completed_at
    FROM quests q
    LEFT JOIN LATERAL (
      SELECT progress, completed_at FROM user_quests
      WHERE user_id = ${userId} AND quest_id = q.id
      ORDER BY created_at DESC
      LIMIT 1
    ) uq ON true
    WHERE q.kind IN ('daily', 'onboarding')
    ORDER BY CASE q.kind WHEN 'daily' THEN 0 WHEN 'onboarding' THEN 1 ELSE 2 END
  `;
  const todayQuestRow = questRows.find((q) => !q.completed_at) ?? questRows[0] ?? null;
  const todayQuest = todayQuestRow
    ? {
        id: todayQuestRow.id,
        nameKey: todayQuestRow.name_key,
        descriptionKey: todayQuestRow.description_key,
        kind: todayQuestRow.kind,
        goal: todayQuestRow.goal,
        progress: todayQuestRow.progress ?? {},
        rewardXp: todayQuestRow.reward_xp,
        completedAt: todayQuestRow.completed_at ? todayQuestRow.completed_at.toISOString() : null,
      }
    : null;

  return {
    userId,
    xpBySkill,
    badges: badgeRows.map((b) => ({
      id: b.id,
      nameKey: b.name_key,
      descriptionKey: b.description_key,
      icon: b.icon,
      earnedAt: b.earned_at.toISOString(),
    })),
    streak: {
      current: streak.current_days,
      longest: streak.longest_days,
      lastActiveDate: streak.last_active_date,
    },
    todayQuest,
  };
}

// ----- zod schemas ----------------------------------------------------------

const userIdParam = z.object({ userId: z.string().uuid() });

const leaderboardQuery = z.object({
  skill: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const manualBody = z.object({
  skill: z.string().trim().min(1).max(64),
  delta: z.number().int().min(-100).max(100),
  reason: z.string().trim().min(1).max(200),
});

// ----- routes ---------------------------------------------------------------

export async function gamificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /gamification/me ----------------------------------------------------
  app.get('/gamification/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getOrCreateUserId(req, reply);
    const profile = await loadProfile(userId);
    return reply.send(profile);
  });

  // GET /gamification/users/:userId/profile --------------------------------
  app.get('/gamification/users/:userId/profile', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = userIdParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_user_id' });
    const profile = await loadProfile(parsed.data.userId);
    return reply.send(profile);
  });

  // GET /gamification/leaderboard -----------------------------------------
  // We restrict to synthetic employees so the demo doesn't expose anonymous
  // browser-session ids. user_id in xp_ledger is a uuid, employees.id is
  // also a uuid — the join naturally filters to known synthetic users.
  app.get('/gamification/leaderboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = leaderboardQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { skill, limit } = parsed.data;

    interface Row {
      user_id: string;
      full_name: string;
      total: string;
    }
    const rows = await sql<Row[]>`
      SELECT x.user_id, e.full_name, COALESCE(SUM(x.delta), 0)::text AS total
      FROM xp_ledger x
      JOIN employees e ON e.id = x.user_id AND e.synthetic = true
      WHERE (${skill ?? null}::text IS NULL OR x.skill = ${skill ?? null})
      GROUP BY x.user_id, e.full_name
      ORDER BY total DESC, e.full_name
      LIMIT ${limit}
    `;
    return reply.send({
      skill: skill ?? null,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.user_id,
        fullName: r.full_name,
        totalXp: Number(r.total) || 0,
      })),
    });
  });

  // GET /gamification/quests -----------------------------------------------
  app.get('/gamification/quests', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getOrCreateUserId(req, reply);
    const rows = await sql<QuestRow[]>`
      SELECT q.id, q.name_key, q.description_key, q.kind, q.goal, q.reward_xp,
             uq.progress, uq.completed_at
      FROM quests q
      LEFT JOIN LATERAL (
        SELECT progress, completed_at FROM user_quests
        WHERE user_id = ${userId}::uuid AND quest_id = q.id
        ORDER BY created_at DESC
        LIMIT 1
      ) uq ON true
      ORDER BY q.kind, q.id
    `;
    return reply.send(rows.map((r) => ({
      id: r.id,
      nameKey: r.name_key,
      descriptionKey: r.description_key,
      kind: r.kind,
      goal: r.goal,
      rewardXp: r.reward_xp,
      progress: r.progress ?? {},
      completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    })));
  });

  // POST /gamification/manual ----------------------------------------------
  // Direct ledger insert — no rules, no cap. Useful for HR overrides / demo
  // resets. TODO(auth): gate behind HR role.
  app.post('/gamification/manual', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = manualBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const userId = getOrCreateUserId(req, reply);
    const { skill, delta, reason } = parsed.data;

    // Manual awards still need a unique key — use timestamp so repeats are
    // allowed (each is a new event in the audit log).
    const idem = `manual:${userId}:${skill}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      INSERT INTO xp_ledger (user_id, skill, delta, reason, source_kind, source_id, idempotency_key)
      VALUES (${userId}, ${skill}, ${delta}, ${reason}, 'manual', null, ${idem})
    `;
    return reply.status(201).send({ ok: true, userId, skill, delta, reason });
  });
}
