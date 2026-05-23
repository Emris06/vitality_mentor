import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sql } from '../plugins/db';
import { getOrCreateUserId } from '../lib/session';

// ──────────────────────────────────────────────────────────────────────────
// Intern API surface.
//
// Two endpoints, both scoped to the calling user (resolved via JWT or the
// dev cookie). Returns a graceful "no newcomer record" shape when the
// caller isn't a registered newcomer — the dashboard UI handles either case.
// ──────────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

interface NewcomerRow {
  modules_completed: number;
  modules_total: number;
  onboarding_deadline: string | null;
  assigned_mentor_id: string | null;
  mentor_full_name: string | null;
}

interface ScoredRunRow {
  id: string;
  scenario_id: string;
  score: number | null;
  status: string;
  created_at: Date;
}

interface CohortMemberRow {
  user_id: string;
  full_name: string | null;
  total_xp: string;
}

interface InternMeResponse {
  profile: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
  };
  onboarding: {
    modulesCompleted: number;
    modulesTotal: number;
    deadline: string | null;
    assignedMentorName: string | null;
  };
  recentRuns: Array<{
    id: string;
    scenarioId: string;
    score: number | null;
    status: string;
    createdAt: string;
  }>;
  cohort: Array<{
    id: string;
    initials: string;
    fullName: string;
    totalXp: number;
    level: number;
  }>;
}

const LEVEL_XP = 600;

function initialsFrom(name: string | null | undefined): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) {
    const first = parts[0]!;
    return first.slice(0, 2).toUpperCase();
  }
  const a = parts[0]!.charAt(0);
  const b = parts[parts.length - 1]!.charAt(0);
  return (a + b).toUpperCase();
}

export async function internRoutes(app: FastifyInstance): Promise<void> {
  // GET /interns/me ----------------------------------------------------------
  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getOrCreateUserId(req, reply);

    // Profile is optional — dev cookie users may not have a profiles row.
    const profileRows = await sql<ProfileRow[]>`
      SELECT id, full_name, role, avatar_url
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `;
    const profileRow = profileRows[0];
    const profile = {
      id: userId,
      fullName: profileRow?.full_name ?? 'Intern',
      role: profileRow?.role ?? 'intern',
      avatarUrl: profileRow?.avatar_url ?? null,
    };

    // Newcomer record + currently-assigned mentor name (if any). The
    // newcomers table is keyed by employee_id which mirrors the user id in
    // demo data — production wiring would route through a join table.
    const newcomerRows = await sql<NewcomerRow[]>`
      SELECT
        n.modules_completed,
        n.modules_total,
        n.onboarding_deadline::text AS onboarding_deadline,
        n.assigned_mentor_id,
        m.full_name AS mentor_full_name
      FROM newcomers n
      LEFT JOIN employees m ON m.id = n.assigned_mentor_id
      WHERE n.employee_id = ${userId}
      LIMIT 1
    `;
    const newcomerRow = newcomerRows[0];
    const onboarding = {
      modulesCompleted: newcomerRow?.modules_completed ?? 0,
      modulesTotal: newcomerRow?.modules_total ?? 0,
      deadline: newcomerRow?.onboarding_deadline ?? null,
      assignedMentorName: newcomerRow?.mentor_full_name ?? null,
    };

    // Recent scored runs for this user. user_id on scenario_runs is text,
    // matching either the cookie UUID or a JWT subject.
    const runRows = await sql<ScoredRunRow[]>`
      SELECT id, scenario_id, score, status, created_at
      FROM scenario_runs
      WHERE user_id = ${userId}
        AND status = 'scored'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recentRuns = runRows.map((r) => ({
      id: r.id,
      scenarioId: r.scenario_id,
      score: r.score,
      status: r.status,
      createdAt: r.created_at.toISOString(),
    }));

    // Cohort: other newcomers sharing the same assigned mentor. If the
    // current user has no mentor yet, fall back to the broader newcomer
    // pool so the UI has something to render.
    let cohortRows: CohortMemberRow[] = [];
    if (newcomerRow?.assigned_mentor_id) {
      cohortRows = await sql<CohortMemberRow[]>`
        SELECT
          n.employee_id AS user_id,
          e.full_name,
          COALESCE(SUM(x.delta), 0)::text AS total_xp
        FROM newcomers n
        JOIN employees e ON e.id = n.employee_id
        LEFT JOIN xp_ledger x ON x.user_id = n.employee_id
        WHERE n.assigned_mentor_id = ${newcomerRow.assigned_mentor_id}
          AND n.employee_id <> ${userId}
        GROUP BY n.employee_id, e.full_name
        ORDER BY total_xp DESC, e.full_name ASC
        LIMIT 10
      `;
    } else {
      cohortRows = await sql<CohortMemberRow[]>`
        SELECT
          n.employee_id AS user_id,
          e.full_name,
          COALESCE(SUM(x.delta), 0)::text AS total_xp
        FROM newcomers n
        JOIN employees e ON e.id = n.employee_id
        LEFT JOIN xp_ledger x ON x.user_id = n.employee_id
        WHERE n.employee_id <> ${userId}
        GROUP BY n.employee_id, e.full_name
        ORDER BY total_xp DESC, e.full_name ASC
        LIMIT 10
      `;
    }

    const cohort = cohortRows.map((row) => {
      const totalXp = Number(row.total_xp ?? '0') || 0;
      return {
        id: row.user_id,
        initials: initialsFrom(row.full_name),
        fullName: row.full_name ?? 'Intern',
        totalXp,
        level: Math.floor(totalXp / LEVEL_XP) + 1,
      };
    });

    const response: InternMeResponse = {
      profile,
      onboarding,
      recentRuns,
      cohort,
    };
    return reply.send(response);
  });

  // GET /interns/me/activity -------------------------------------------------
  app.get('/me/activity', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getOrCreateUserId(req, reply);

    const limit = Math.min(Number((req.query as any).limit ?? 10), 50);
    const offset = Number((req.query as any).offset ?? 0);

    // Three sources, unioned into a single chronological activity list. No
    // new tables needed — we re-render from existing state every request.
    interface ActivityRow {
      id: string;
      variant: 'sim_scored' | 'mentor_assigned' | 'quest_completed';
      actor_name: string;
      created_at: Date;
    }

    const rows = await sql<ActivityRow[]>`
      (
        SELECT
          id::text AS id,
          'sim_scored'::text AS variant,
          scenario_id AS actor_name,
          COALESCE(finished_at, started_at) AS created_at
        FROM scenario_runs
        WHERE user_id = ${userId} AND status = 'scored'
      )
      UNION ALL
      (
        SELECT
          a.id::text AS id,
          'mentor_assigned'::text AS variant,
          COALESCE(e.full_name, 'Mentor') AS actor_name,
          a.assigned_at AS created_at
        FROM mentor_assignments a
        LEFT JOIN employees e ON e.id = a.mentor_id
        WHERE a.newcomer_id = ${userId}::uuid
          AND a.status = 'active'
      )
      UNION ALL
      (
        SELECT
          (uq.user_id::text || ':' || uq.quest_id || ':' || EXTRACT(EPOCH FROM uq.completed_at)::text) AS id,
          'quest_completed'::text AS variant,
          uq.quest_id AS actor_name,
          uq.completed_at AS created_at
        FROM user_quests uq
        WHERE uq.user_id = ${userId}::uuid
          AND uq.completed_at IS NOT NULL
      )
      ORDER BY created_at DESC NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const entries = rows.map((row) => ({
      id: row.id,
      variant: row.variant,
      actorName: row.actor_name ?? '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }));

    return reply.send(entries);
  });
}
