import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Employee, Newcomer, EmployeeRole, Locale } from '@vitality/shared';
import { sql } from '../plugins/db';
import { bestMatches } from '../hr/matching';
import { publishHrEvent } from '../hr/events';

/**
 * HR dashboard REST surface.
 *
 * TODO(auth): every handler here is currently anonymous (read & write). The
 *             session helper only identifies a browser, not an HR role. Before
 *             any non-Ideathon deployment, gate these on a role claim from
 *             the real HR identity provider.
 */

// ----- shared types & helpers ----------------------------------------------

interface EmployeeRow {
  id: string;
  full_name: string;
  role: EmployeeRole;
  department: string | null;
  position: string | null;
  languages: string[];
  current_load: number;
  skills: string[];
  hired_at: string | null;
}

interface NewcomerRow extends EmployeeRow {
  start_date: string;
  onboarding_deadline: string;
  assigned_mentor_id: string | null;
  modules_completed: number;
  modules_total: number;
}

function rowToEmployee(row: EmployeeRow): Employee {
  const e: Employee = {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    languages: (row.languages as Locale[]) ?? [],
    currentLoad: row.current_load,
    skills: row.skills ?? [],
  };
  if (row.department !== null) e.department = row.department;
  if (row.position !== null) e.position = row.position;
  if (row.hired_at !== null) e.hiredAt = row.hired_at;
  return e;
}

function rowToNewcomer(row: NewcomerRow): Newcomer {
  const base = rowToEmployee(row);
  const nc: Newcomer = {
    ...base,
    role: 'newcomer',
    startDate: row.start_date,
    onboardingDeadline: row.onboarding_deadline,
    modulesCompleted: row.modules_completed,
    modulesTotal: row.modules_total,
  };
  if (row.assigned_mentor_id) nc.assignedMentorId = row.assigned_mentor_id;
  return nc;
}

function progressPct(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** RFC 4180 CSV cell quoting. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(',');
}

// ----- zod schemas ----------------------------------------------------------

const ROLE_VALUES = ['hr', 'mentor', 'newcomer', 'employee', 'admin'] as const;

const listEmployeesQuery = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

const assignBody = z.object({ mentorId: z.string().uuid() });

// ----- routes ---------------------------------------------------------------

export async function hrRoutes(app: FastifyInstance): Promise<void> {
  // GET /hr/employees -------------------------------------------------------
  app.get('/hr/employees', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = listEmployeesQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }
    const { role, q } = parsed.data;

    // We use parametrised template literals so role/q are never inlined.
    const rows = await sql<EmployeeRow[]>`
      SELECT id, full_name, role, department, position, languages, current_load, skills,
             hired_at::text AS hired_at
      FROM employees
      WHERE (${role ?? null}::text IS NULL OR role = ${role ?? null})
        AND (${q ?? null}::text IS NULL OR full_name ILIKE ${'%' + (q ?? '') + '%'})
      ORDER BY full_name
      LIMIT 200
    `;
    return reply.send({ employees: rows.map(rowToEmployee) });
  });

  // GET /hr/newcomers -------------------------------------------------------
  // Returns each newcomer joined with their currently-assigned mentor (if any)
  // and a derived progress percentage.
  app.get('/hr/newcomers', async (_req: FastifyRequest, reply: FastifyReply) => {
    interface JoinedRow extends NewcomerRow {
      mentor_id: string | null;
      mentor_full_name: string | null;
      mentor_languages: string[] | null;
      mentor_skills: string[] | null;
      mentor_current_load: number | null;
    }
    const rows = await sql<JoinedRow[]>`
      SELECT
        e.id, e.full_name, e.role, e.department, e.position, e.languages,
        e.current_load, e.skills, e.hired_at::text AS hired_at,
        n.start_date::text AS start_date,
        n.onboarding_deadline::text AS onboarding_deadline,
        n.assigned_mentor_id, n.modules_completed, n.modules_total,
        m.id AS mentor_id, m.full_name AS mentor_full_name,
        m.languages AS mentor_languages, m.skills AS mentor_skills,
        m.current_load AS mentor_current_load
      FROM newcomers n
      JOIN employees e ON e.id = n.employee_id
      LEFT JOIN employees m ON m.id = n.assigned_mentor_id
      ORDER BY e.full_name
    `;

    const newcomers = rows.map((r) => {
      const nc = rowToNewcomer(r);
      const mentor = r.mentor_id
        ? {
            id: r.mentor_id,
            fullName: r.mentor_full_name ?? '',
            languages: r.mentor_languages ?? [],
            skills: r.mentor_skills ?? [],
            currentLoad: r.mentor_current_load ?? 0,
          }
        : null;
      return {
        ...nc,
        progressPct: progressPct(nc.modulesCompleted, nc.modulesTotal),
        mentor,
      };
    });
    return reply.send({ newcomers });
  });

  // GET /hr/newcomers/:id ---------------------------------------------------
  app.get('/hr/newcomers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const { id } = parsed.data;

    const rows = await sql<(NewcomerRow & {
      mentor_id: string | null;
      mentor_full_name: string | null;
      mentor_languages: string[] | null;
      mentor_skills: string[] | null;
      mentor_current_load: number | null;
    })[]>`
      SELECT
        e.id, e.full_name, e.role, e.department, e.position, e.languages,
        e.current_load, e.skills, e.hired_at::text AS hired_at,
        n.start_date::text AS start_date,
        n.onboarding_deadline::text AS onboarding_deadline,
        n.assigned_mentor_id, n.modules_completed, n.modules_total,
        m.id AS mentor_id, m.full_name AS mentor_full_name,
        m.languages AS mentor_languages, m.skills AS mentor_skills,
        m.current_load AS mentor_current_load
      FROM newcomers n
      JOIN employees e ON e.id = n.employee_id
      LEFT JOIN employees m ON m.id = n.assigned_mentor_id
      WHERE e.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return reply.status(404).send({ error: 'not_found' });

    const nc = rowToNewcomer(row);
    const mentor = row.mentor_id
      ? {
          id: row.mentor_id,
          fullName: row.mentor_full_name ?? '',
          languages: row.mentor_languages ?? [],
          skills: row.mentor_skills ?? [],
          currentLoad: row.mentor_current_load ?? 0,
        }
      : null;

    // Recent simulator runs. user_id on scenario_runs is a free-form text
    // identifier (a browser cookie UUID); for the HR view we just match it
    // against the newcomer's id so the seeder can wire demo runs to a
    // newcomer. Older real users won't have any matching rows — fine.
    interface RunRow {
      id: string;
      scenario_id: string;
      status: string;
      score: number | null;
      started_at: Date;
      finished_at: Date | null;
    }
    const runs = await sql<RunRow[]>`
      SELECT id, scenario_id, status, score, started_at, finished_at
      FROM scenario_runs
      WHERE user_id = ${id}
      ORDER BY started_at DESC
      LIMIT 5
    `;

    return reply.send({
      newcomer: { ...nc, progressPct: progressPct(nc.modulesCompleted, nc.modulesTotal) },
      mentor,
      recentRuns: runs.map((r) => ({
        id: r.id,
        scenarioId: r.scenario_id,
        status: r.status,
        score: r.score,
        startedAt: r.started_at.toISOString(),
        finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
      })),
    });
  });

  // POST /hr/newcomers/:id/match -------------------------------------------
  // Pure read: returns top 5 mentor candidates (not yet at max load).
  app.post('/hr/newcomers/:id/match', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const { id } = parsed.data;

    const ncRows = await sql<NewcomerRow[]>`
      SELECT e.id, e.full_name, e.role, e.department, e.position, e.languages,
             e.current_load, e.skills, e.hired_at::text AS hired_at,
             n.start_date::text AS start_date,
             n.onboarding_deadline::text AS onboarding_deadline,
             n.assigned_mentor_id, n.modules_completed, n.modules_total
      FROM newcomers n JOIN employees e ON e.id = n.employee_id
      WHERE e.id = ${id} LIMIT 1
    `;
    const ncRow = ncRows[0];
    if (!ncRow) return reply.status(404).send({ error: 'not_found' });

    const mentorRows = await sql<EmployeeRow[]>`
      SELECT id, full_name, role, department, position, languages, current_load,
             skills, hired_at::text AS hired_at
      FROM employees
      WHERE role = 'mentor' AND current_load < 3
    `;
    const mentorById = new Map<string, Employee>();
    for (const r of mentorRows) mentorById.set(r.id, rowToEmployee(r));

    const newcomer = rowToNewcomer(ncRow);
    const matches = bestMatches(Array.from(mentorById.values()), newcomer, 5).map((m) => {
      const mentor = mentorById.get(m.mentorId);
      return {
        mentorId: m.mentorId,
        mentorName: mentor?.fullName ?? '',
        score: m.score,
        reasons: m.reasons,
        currentLoad: mentor?.currentLoad ?? 0,
        skills: mentor?.skills ?? [],
        languages: mentor?.languages ?? [],
      };
    });

    return reply.send({ newcomerId: id, matches });
  });

  // POST /hr/newcomers/:id/assign ------------------------------------------
  // Single transaction:
  //   1. pause any existing active assignment + decrement that mentor's load
  //   2. insert new active assignment
  //   3. update newcomer.assigned_mentor_id
  //   4. increment new mentor's current_load
  app.post('/hr/newcomers/:id/assign', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParam.safeParse(req.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const bodyParsed = assignBody.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: 'invalid_request', details: bodyParsed.error.flatten() });
    }
    const newcomerId = paramsParsed.data.id;
    const { mentorId } = bodyParsed.data;

    try {
      const result = await sql.begin(async (tx) => {
        // Load the newcomer (with row lock) and the candidate mentor.
        const ncRows = await tx<NewcomerRow[]>`
          SELECT e.id, e.full_name, e.role, e.department, e.position, e.languages,
                 e.current_load, e.skills, e.hired_at::text AS hired_at,
                 n.start_date::text AS start_date,
                 n.onboarding_deadline::text AS onboarding_deadline,
                 n.assigned_mentor_id, n.modules_completed, n.modules_total
          FROM newcomers n JOIN employees e ON e.id = n.employee_id
          WHERE e.id = ${newcomerId}
          FOR UPDATE OF n
        `;
        const ncRow = ncRows[0];
        if (!ncRow) throw new Error('not_found_newcomer');

        const mRows = await tx<EmployeeRow[]>`
          SELECT id, full_name, role, department, position, languages, current_load,
                 skills, hired_at::text AS hired_at
          FROM employees WHERE id = ${mentorId} AND role = 'mentor'
          FOR UPDATE
        `;
        const mRow = mRows[0];
        if (!mRow) throw new Error('not_found_mentor');

        // Pause the previous active assignment, if any.
        if (ncRow.assigned_mentor_id) {
          await tx`
            UPDATE mentor_assignments
            SET status = 'paused', unassigned_at = now()
            WHERE newcomer_id = ${newcomerId} AND status = 'active'
          `;
          await tx`
            UPDATE employees
            SET current_load = GREATEST(current_load - 1, 0), updated_at = now()
            WHERE id = ${ncRow.assigned_mentor_id}
          `;
        }

        // Compute the match score for transparency / audit.
        const newcomer = rowToNewcomer(ncRow);
        const mentor = rowToEmployee(mRow);
        const [match] = bestMatches([mentor], newcomer, 1);
        const score = match?.score ?? 0;
        const reasons = match?.reasons ?? [];

        const inserted = await tx<{ id: string }[]>`
          INSERT INTO mentor_assignments
            (mentor_id, newcomer_id, status, match_score, match_reasons)
          VALUES
            (${mentorId}, ${newcomerId}, 'active', ${score}, ${tx.json(reasons as unknown as object)})
          RETURNING id
        `;
        const assignmentRow = inserted[0];
        if (!assignmentRow) throw new Error('insert_failed');

        await tx`
          UPDATE newcomers SET assigned_mentor_id = ${mentorId}
          WHERE employee_id = ${newcomerId}
        `;
        await tx`
          UPDATE employees
          SET current_load = current_load + 1, updated_at = now()
          WHERE id = ${mentorId}
        `;

        return { assignmentId: assignmentRow.id, score, reasons };
      });

      await publishHrEvent({
        type: 'hr.assigned',
        payload: { assignmentId: result.assignmentId, mentorId, newcomerId },
      });

      return reply.status(201).send({
        assignmentId: result.assignmentId,
        mentorId,
        newcomerId,
        matchScore: result.score,
        matchReasons: result.reasons,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'not_found_newcomer' || msg === 'not_found_mentor') {
        return reply.status(404).send({ error: msg });
      }
      req.log.error({ err }, 'hr assign failed');
      return reply.status(500).send({ error: 'internal_error' });
    }
  });

  // POST /hr/newcomers/:id/unassign ----------------------------------------
  app.post('/hr/newcomers/:id/unassign', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_id' });
    const newcomerId = parsed.data.id;

    try {
      const result = await sql.begin(async (tx) => {
        const ncRows = await tx<{ assigned_mentor_id: string | null }[]>`
          SELECT assigned_mentor_id FROM newcomers
          WHERE employee_id = ${newcomerId}
          FOR UPDATE
        `;
        const ncRow = ncRows[0];
        if (!ncRow) throw new Error('not_found');
        const previousMentorId = ncRow.assigned_mentor_id;
        if (!previousMentorId) return { mentorId: null };

        await tx`
          UPDATE mentor_assignments
          SET status = 'paused', unassigned_at = now()
          WHERE newcomer_id = ${newcomerId} AND status = 'active'
        `;
        await tx`
          UPDATE newcomers SET assigned_mentor_id = NULL
          WHERE employee_id = ${newcomerId}
        `;
        await tx`
          UPDATE employees
          SET current_load = GREATEST(current_load - 1, 0), updated_at = now()
          WHERE id = ${previousMentorId}
        `;
        return { mentorId: previousMentorId };
      });

      if (result.mentorId) {
        await publishHrEvent({
          type: 'hr.unassigned',
          payload: { newcomerId, mentorId: result.mentorId },
        });
      }

      return reply.send({ newcomerId, previousMentorId: result.mentorId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'not_found') return reply.status(404).send({ error: 'not_found' });
      req.log.error({ err }, 'hr unassign failed');
      return reply.status(500).send({ error: 'internal_error' });
    }
  });

  // GET /hr/dashboard/summary ----------------------------------------------
  app.get('/hr/dashboard/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    const countsRows = await sql<{
      total: string;
      assigned: string;
      unassigned: string;
    }[]>`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE assigned_mentor_id IS NOT NULL)::text AS assigned,
        COUNT(*) FILTER (WHERE assigned_mentor_id IS NULL)::text AS unassigned
      FROM newcomers
    `;
    const counts = countsRows[0] ?? { total: '0', assigned: '0', unassigned: '0' };

    const scoredRows = await sql<{ runs: string; avg_score: string | null }[]>`
      SELECT COUNT(*)::text AS runs, AVG(score)::text AS avg_score
      FROM scenario_runs
      WHERE status = 'scored' AND finished_at >= now() - interval '7 days'
    `;
    const scored = scoredRows[0] ?? { runs: '0', avg_score: null };

    interface TopMentorRow {
      mentor_id: string;
      full_name: string;
      completed: string;
    }
    const topMentors = await sql<TopMentorRow[]>`
      SELECT a.mentor_id, e.full_name, COUNT(*)::text AS completed
      FROM mentor_assignments a
      JOIN employees e ON e.id = a.mentor_id
      WHERE a.status = 'completed'
      GROUP BY a.mentor_id, e.full_name
      ORDER BY COUNT(*) DESC, e.full_name
      LIMIT 5
    `;

    return reply.send({
      newcomers: {
        total: Number(counts.total),
        assigned: Number(counts.assigned),
        unassigned: Number(counts.unassigned),
      },
      simulator: {
        scoredRunsLast7d: Number(scored.runs),
        avgScoreLast7d: scored.avg_score === null ? null : Number(Number(scored.avg_score).toFixed(1)),
      },
      topMentors: topMentors.map((r) => ({
        mentorId: r.mentor_id,
        fullName: r.full_name,
        completedNewcomers: Number(r.completed),
      })),
    });
  });

  // GET /hr/export.csv ------------------------------------------------------
  app.get('/hr/export.csv', async (_req: FastifyRequest, reply: FastifyReply) => {
    interface ExportRow {
      id: string;
      full_name: string;
      start_date: string;
      onboarding_deadline: string;
      mentor_name: string | null;
      modules_completed: number;
      modules_total: number;
      avg_score: string | null;
    }
    const rows = await sql<ExportRow[]>`
      SELECT
        e.id,
        e.full_name,
        n.start_date::text AS start_date,
        n.onboarding_deadline::text AS onboarding_deadline,
        m.full_name AS mentor_name,
        n.modules_completed,
        n.modules_total,
        (
          SELECT AVG(score)::text FROM scenario_runs r
          WHERE r.user_id = e.id AND r.status = 'scored'
        ) AS avg_score
      FROM newcomers n
      JOIN employees e ON e.id = n.employee_id
      LEFT JOIN employees m ON m.id = n.assigned_mentor_id
      ORDER BY e.full_name
    `;

    const header = ['id', 'fullName', 'startDate', 'deadline', 'mentor', 'progressPct', 'avgScore'];
    const lines: string[] = [csvRow(header)];
    for (const r of rows) {
      lines.push(csvRow([
        r.id,
        r.full_name,
        r.start_date,
        r.onboarding_deadline,
        r.mentor_name ?? '',
        progressPct(r.modules_completed, r.modules_total),
        r.avg_score === null ? '' : Number(r.avg_score).toFixed(1),
      ]));
    }
    // CRLF per RFC 4180; trailing newline keeps Excel happy.
    const body = lines.join('\r\n') + '\r\n';

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="newcomers.csv"');
    return reply.send(body);
  });
}
