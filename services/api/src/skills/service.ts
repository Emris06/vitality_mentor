/**
 * Skills service — pure-where-possible functions over the gamification XP
 * ledger + the skills taxonomy seeded in 005_skills.sql.
 *
 * Data sources:
 *   * xp_ledger (004_gamification.sql) — append-only XP awards. We never write
 *     it here; we only read SUM(delta) per user per skill. The `skill` column
 *     is free-form (the seeder emits 'KYC', 'Customer Service', etc.), so we
 *     normalise to the canonical skill_nodes.id space via normaliseSkillId().
 *   * skill_nodes / role_skill_requirements / training_modules — taxonomy.
 *   * skill_forecasts_cache — 1h TTL cache for forecast payloads.
 *
 * Conventions:
 *   * level = floor(xp / 25). Same rule across the platform.
 *   * Gap severity buckets: 0-25% low, 25-60% medium, >60% high.
 */

import type {
  Employee,
  EmployeeRole,
  Locale,
  PromotionReadiness,
  SkillForecast,
  SkillGap,
  SkillLevel,
  SkillNode,
} from '@vitality/shared';
import { asJson, sql } from '../plugins/db';

// ----- public types ---------------------------------------------------------

export interface TeamGapMatrix {
  employees: Employee[];
  skills: string[];
  cells: Array<{
    employeeId: string;
    skillId: string;
    xp: number;
    severity?: 'low' | 'medium' | 'high';
  }>;
}

export interface TeamAnalyticsPercentile {
  skillId: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface TeamAnalyticsVelocity {
  date: string;            // YYYY-MM-DD
  modulesCompleted: number;
  scoredRuns: number;
}

export interface TeamAnalyticsMentor {
  mentorId: string;
  name: string;
  avgNewcomerScore: number | null;
  completedCount: number;
}

export interface TeamAnalytics {
  skillDistribution: TeamAnalyticsPercentile[];
  completionVelocity: TeamAnalyticsVelocity[];
  mentorEffectiveness: TeamAnalyticsMentor[];
}

// ----- helpers --------------------------------------------------------------

/**
 * Normalise the free-form xp_ledger.skill string to the canonical
 * skill_nodes.id space. xp_ledger is populated by the gamification worker
 * with strings like 'KYC' or 'Customer Service' (see hr/seed.ts BANKING_SKILLS
 * and gamification/rules.ts); we map those into the snake_case taxonomy ids.
 */
export function normaliseSkillId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

export function levelFromXp(xp: number): number {
  return Math.max(0, Math.floor(xp / 25));
}

function severityForGap(gapPct: number): 'low' | 'medium' | 'high' {
  if (gapPct <= 0.25) return 'low';
  if (gapPct <= 0.6) return 'medium';
  return 'high';
}

// ----- row shapes -----------------------------------------------------------

interface SkillNodeRow {
  id: string;
  name_key: string;
  category: string;
  related_skill_ids: string[];
  target_xp: number;
}

interface RoleReqRow {
  role: string;
  skill_id: string;
  min_xp: number;
  weight: string;        // numeric → string from postgres.js
}

interface XpAggRow {
  skill: string;
  sum: string;
  last_at: Date | null;
}

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

// ----- taxonomy ------------------------------------------------------------

export async function getTaxonomy(): Promise<SkillNode[]> {
  const rows = await sql<SkillNodeRow[]>`
    SELECT id, name_key, category, related_skill_ids, target_xp
    FROM skill_nodes
    ORDER BY category, id
  `;
  return rows.map((r) => ({
    id: r.id,
    nameKey: r.name_key,
    category: r.category,
    relatedSkillIds: r.related_skill_ids ?? [],
  }));
}

// ----- profile -------------------------------------------------------------

/** SUM(xp_ledger.delta) per skill for a single employee, normalised to taxonomy ids. */
async function aggregateXp(
  employeeId: string,
): Promise<Map<string, { xp: number; lastAt: Date | null }>> {
  const rows = await sql<XpAggRow[]>`
    SELECT skill,
           COALESCE(SUM(delta), 0)::text AS sum,
           MAX(created_at) AS last_at
    FROM xp_ledger
    WHERE user_id = ${employeeId}
    GROUP BY skill
  `;
  const agg = new Map<string, { xp: number; lastAt: Date | null }>();
  for (const r of rows) {
    const key = normaliseSkillId(r.skill);
    const prev = agg.get(key);
    const xp = (prev?.xp ?? 0) + (Number(r.sum) || 0);
    // pick max lastAt across collisions (e.g. 'KYC' + 'kyc' both contribute)
    let lastAt: Date | null = prev?.lastAt ?? null;
    if (r.last_at && (!lastAt || r.last_at > lastAt)) lastAt = r.last_at;
    agg.set(key, { xp, lastAt });
  }
  return agg;
}

/**
 * Returns one SkillLevel row per taxonomy node — even when the employee has
 * zero XP in that skill — so the frontend radar chart has a stable axis.
 */
export async function getSkillProfile(employeeId: string): Promise<SkillLevel[]> {
  const [nodes, agg] = await Promise.all([
    sql<{ id: string }[]>`SELECT id FROM skill_nodes ORDER BY id`,
    aggregateXp(employeeId),
  ]);
  const nowIso = new Date().toISOString();
  return nodes.map((n) => {
    const entry = agg.get(n.id);
    const xp = entry?.xp ?? 0;
    return {
      skillId: n.id,
      xp,
      level: levelFromXp(xp),
      updatedAt: entry?.lastAt ? entry.lastAt.toISOString() : nowIso,
    };
  });
}

// ----- gaps + readiness ----------------------------------------------------

async function loadRoleRequirements(targetRole: string): Promise<RoleReqRow[]> {
  return sql<RoleReqRow[]>`
    SELECT role, skill_id, min_xp, weight::text AS weight
    FROM role_skill_requirements
    WHERE role = ${targetRole}
    ORDER BY skill_id
  `;
}

export async function getSkillGaps(
  employeeId: string,
  targetRole: string,
): Promise<SkillGap[]> {
  const [reqs, agg] = await Promise.all([
    loadRoleRequirements(targetRole),
    aggregateXp(employeeId),
  ]);
  return reqs.map((req) => {
    const current = agg.get(req.skill_id)?.xp ?? 0;
    const deficit = Math.max(0, req.min_xp - current);
    const gapPct = req.min_xp > 0 ? deficit / req.min_xp : 0;
    return {
      skillId: req.skill_id,
      current,
      target: req.min_xp,
      severity: severityForGap(gapPct),
    };
  });
}

export async function getPromotionReadiness(
  employeeId: string,
  targetRole: string,
): Promise<PromotionReadiness> {
  const [reqs, agg] = await Promise.all([
    loadRoleRequirements(targetRole),
    aggregateXp(employeeId),
  ]);

  const met: string[] = [];
  const missing: string[] = [];
  const gapPcts: number[] = [];

  for (const req of reqs) {
    const current = agg.get(req.skill_id)?.xp ?? 0;
    if (current >= req.min_xp) {
      met.push(req.skill_id);
      gapPcts.push(0);
    } else {
      missing.push(req.skill_id);
      const deficit = req.min_xp - current;
      gapPcts.push(req.min_xp > 0 ? deficit / req.min_xp : 1);
    }
  }

  const meanGap = gapPcts.length === 0
    ? 0
    : gapPcts.reduce((a, b) => a + b, 0) / gapPcts.length;
  const confidence = Math.max(0, Math.min(1, 1 - meanGap));

  return {
    employeeId,
    targetRole,
    ready: missing.length === 0 && reqs.length > 0,
    metRequirements: met,
    missingRequirements: missing,
    confidence: Number(confidence.toFixed(3)),
  };
}

// ----- single-employee lookups (used by the route layer) -------------------

export async function getEmployee(employeeId: string): Promise<Employee | null> {
  const rows = await sql<EmployeeRow[]>`
    SELECT id, full_name, role, department, position, languages, current_load, skills,
           hired_at::text AS hired_at
    FROM employees
    WHERE id = ${employeeId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return rowToEmployee(row);
}

// ----- team gap matrix ------------------------------------------------------

export async function getTeamGapMatrix(filters: {
  department?: string;
  targetRole?: string;
}): Promise<TeamGapMatrix> {
  const { department, targetRole } = filters;

  // Pull every (non-newcomer? we keep all) employee for the dashboard. Filter
  // by department when supplied. Limit to 200 rows so the matrix stays small.
  const employeeRows = await sql<EmployeeRow[]>`
    SELECT id, full_name, role, department, position, languages, current_load, skills,
           hired_at::text AS hired_at
    FROM employees
    WHERE (${department ?? null}::text IS NULL OR department = ${department ?? null})
    ORDER BY full_name
    LIMIT 200
  `;
  const employees = employeeRows.map(rowToEmployee);
  if (employees.length === 0) {
    return { employees: [], skills: [], cells: [] };
  }

  // Skill axis: requirements for the target role if supplied; otherwise the
  // full taxonomy. Either way we sort deterministically.
  let skillIds: string[];
  let requirements: Map<string, number> = new Map();
  if (targetRole) {
    const reqs = await loadRoleRequirements(targetRole);
    skillIds = reqs.map((r) => r.skill_id);
    for (const r of reqs) requirements.set(r.skill_id, r.min_xp);
  } else {
    const nodes = await sql<{ id: string }[]>`SELECT id FROM skill_nodes ORDER BY category, id`;
    skillIds = nodes.map((n) => n.id);
  }

  // Bulk-aggregate XP for the filtered cohort in one round trip.
  const employeeIds = employees.map((e) => e.id);
  interface BulkXpRow { user_id: string; skill: string; sum: string }
  const xpRows = await sql<BulkXpRow[]>`
    SELECT user_id::text, skill, COALESCE(SUM(delta), 0)::text AS sum
    FROM xp_ledger
    WHERE user_id = ANY(${employeeIds}::uuid[])
    GROUP BY user_id, skill
  `;
  const xpByEmpSkill = new Map<string, number>();
  for (const r of xpRows) {
    const key = `${r.user_id}::${normaliseSkillId(r.skill)}`;
    xpByEmpSkill.set(key, (xpByEmpSkill.get(key) ?? 0) + (Number(r.sum) || 0));
  }

  const cells: TeamGapMatrix['cells'] = [];
  for (const emp of employees) {
    for (const skillId of skillIds) {
      const xp = xpByEmpSkill.get(`${emp.id}::${skillId}`) ?? 0;
      const req = requirements.get(skillId);
      let severity: 'low' | 'medium' | 'high' | undefined;
      if (req !== undefined) {
        const deficit = Math.max(0, req - xp);
        severity = severityForGap(req > 0 ? deficit / req : 0);
      }
      const cell: TeamGapMatrix['cells'][number] = { employeeId: emp.id, skillId, xp };
      if (severity !== undefined) cell.severity = severity;
      cells.push(cell);
    }
  }

  return { employees, skills: skillIds, cells };
}

// ----- forecast cache -------------------------------------------------------

const FORECAST_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getCachedForecast(
  employeeId: string,
  skillId: string,
  horizonDays: number,
): Promise<SkillForecast | null> {
  const rows = await sql<{ payload: SkillForecast; computed_at: Date }[]>`
    SELECT payload, computed_at
    FROM skill_forecasts_cache
    WHERE employee_id = ${employeeId}
      AND skill_id = ${skillId}
      AND horizon_days = ${horizonDays}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const ageMs = Date.now() - row.computed_at.getTime();
  if (ageMs > FORECAST_TTL_MS) return null;
  return row.payload;
}

export async function cacheForecast(
  employeeId: string,
  skillId: string,
  horizonDays: number,
  payload: SkillForecast,
): Promise<void> {
  await sql`
    INSERT INTO skill_forecasts_cache (employee_id, skill_id, horizon_days, payload, computed_at)
    VALUES (${employeeId}, ${skillId}, ${horizonDays}, ${sql.json(asJson(payload))}, now())
    ON CONFLICT (employee_id, skill_id, horizon_days) DO UPDATE
      SET payload = EXCLUDED.payload,
          computed_at = now()
  `;
}

/**
 * Last-N-days history for a single (employee, skill) — used both as input to
 * the AI forecast call and as the fallback OLS regressor.
 *
 * Returns a row per *day*, cumulatively summing the ledger so the series
 * monotonically reflects total skill XP at that date.
 */
export async function getSkillHistory(
  employeeId: string,
  skillId: string,
  days: number,
): Promise<{ date: string; xp: number }[]> {
  interface DailyRow { day: string; delta: string }
  // Match skill on either the normalised id OR the raw stored string by
  // lowercasing both sides; xp_ledger.skill is free-form.
  const rows = await sql<DailyRow[]>`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(delta), 0)::text AS delta
    FROM xp_ledger
    WHERE user_id = ${employeeId}
      AND lower(replace(skill, ' ', '_')) = ${skillId}
      AND created_at >= now() - (${days}::int * interval '1 day')
    GROUP BY day
    ORDER BY day
  `;

  // Cumulative sum so the series is the running XP total — the linear
  // regressor wants levels, not deltas.
  let running = 0;
  return rows.map((r) => {
    running += Number(r.delta) || 0;
    return { date: r.day, xp: running };
  });
}

// ----- team analytics -------------------------------------------------------

export async function getTeamAnalytics(filters: {
  department?: string;
}): Promise<TeamAnalytics> {
  const { department } = filters;

  // Filtered employee set: when department is supplied we restrict to those
  // employees, otherwise all synthetic employees.
  const empRows = await sql<{ id: string }[]>`
    SELECT id::text FROM employees
    WHERE (${department ?? null}::text IS NULL OR department = ${department ?? null})
  `;
  const empIds = empRows.map((r) => r.id);

  // Skill distribution — per-skill XP percentiles across the cohort. We sum
  // each employee's XP per skill first, then percentile-aggregate.
  interface DistRow {
    skill_id: string;
    p25: string | null;
    p50: string | null;
    p75: string | null;
    p90: string | null;
  }
  const distRows = empIds.length === 0
    ? []
    : await sql<DistRow[]>`
        WITH per_emp AS (
          SELECT user_id, lower(replace(skill, ' ', '_')) AS skill_id,
                 COALESCE(SUM(delta), 0) AS xp
          FROM xp_ledger
          WHERE user_id = ANY(${empIds}::uuid[])
          GROUP BY user_id, lower(replace(skill, ' ', '_'))
        )
        SELECT skill_id,
               percentile_cont(0.25) WITHIN GROUP (ORDER BY xp)::text AS p25,
               percentile_cont(0.50) WITHIN GROUP (ORDER BY xp)::text AS p50,
               percentile_cont(0.75) WITHIN GROUP (ORDER BY xp)::text AS p75,
               percentile_cont(0.90) WITHIN GROUP (ORDER BY xp)::text AS p90
        FROM per_emp
        WHERE skill_id IN (SELECT id FROM skill_nodes)
        GROUP BY skill_id
        ORDER BY skill_id
      `;
  const skillDistribution: TeamAnalyticsPercentile[] = distRows.map((r) => ({
    skillId: r.skill_id,
    p25: Number(r.p25 ?? 0),
    p50: Number(r.p50 ?? 0),
    p75: Number(r.p75 ?? 0),
    p90: Number(r.p90 ?? 0),
  }));

  // Completion velocity — for the last 30 days, count module-source ledger
  // rows and scored simulator runs per day. xp_ledger.source_kind = 'module'
  // is the closest signal we have for "module completed".
  //
  // When `department` is supplied, we scope BOTH modules and scored runs to
  // employees in that department. ANY(NULL::uuid[]) returns false, so we
  // pass an empty filter (`empIds = []` → use the full set) by sentinelling
  // the IN clause: a null `empIdsParam` disables the filter.
  const empIdsParam = department ? empIds : null;
  interface VelRow { day: string; modules: string; scored: string }
  const velRows = await sql<VelRow[]>`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now() - interval '29 days'),
        date_trunc('day', now()),
        interval '1 day'
      ) AS day
    ),
    mods AS (
      SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
      FROM xp_ledger
      WHERE source_kind = 'module'
        AND created_at >= now() - interval '30 days'
        AND (${empIdsParam}::uuid[] IS NULL OR user_id = ANY(${empIdsParam}::uuid[]))
      GROUP BY 1
    ),
    runs AS (
      SELECT date_trunc('day', finished_at) AS day, COUNT(*) AS n
      FROM scenario_runs
      WHERE status = 'scored'
        AND finished_at >= now() - interval '30 days'
      GROUP BY 1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COALESCE(mods.n, 0)::text AS modules,
           COALESCE(runs.n, 0)::text AS scored
    FROM days d
    LEFT JOIN mods ON mods.day = d.day
    LEFT JOIN runs ON runs.day = d.day
    ORDER BY d.day
  `;
  const completionVelocity: TeamAnalyticsVelocity[] = velRows.map((r) => ({
    date: r.day,
    modulesCompleted: Number(r.modules) || 0,
    scoredRuns: Number(r.scored) || 0,
  }));

  // Mentor effectiveness — avg newcomer scored-run score & completed
  // assignments for each mentor (filtered to mentors whose newcomers have
  // any scored runs). avg_newcomer_score may be null.
  interface MentorRow {
    mentor_id: string;
    full_name: string;
    avg_score: string | null;
    completed_count: string;
  }
  const mentorRows = await sql<MentorRow[]>`
    SELECT m.id::text AS mentor_id,
           m.full_name,
           AVG(r.score)::text AS avg_score,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed')::text AS completed_count
    FROM employees m
    LEFT JOIN mentor_assignments a ON a.mentor_id = m.id
    LEFT JOIN scenario_runs r
      ON r.user_id::text = a.newcomer_id::text
     AND r.status = 'scored'
     AND r.finished_at >= now() - interval '30 days'
    WHERE m.role = 'mentor'
    GROUP BY m.id, m.full_name
    HAVING COUNT(a.id) > 0
    ORDER BY avg_score DESC NULLS LAST, m.full_name
    LIMIT 20
  `;
  const mentorEffectiveness: TeamAnalyticsMentor[] = mentorRows.map((r) => ({
    mentorId: r.mentor_id,
    name: r.full_name,
    avgNewcomerScore: r.avg_score === null ? null : Number(Number(r.avg_score).toFixed(1)),
    completedCount: Number(r.completed_count) || 0,
  }));

  return { skillDistribution, completionVelocity, mentorEffectiveness };
}

// ----- training module lookup (recommender join target) --------------------

export interface TrainingModuleRow {
  id: string;
  titleKey: string | null;
  skillId: string | null;
  estimatedMinutes: number;
  contentUri: string | null;
}

export async function getTrainingModules(): Promise<TrainingModuleRow[]> {
  const rows = await sql<{
    id: string;
    title_key: string | null;
    skill_id: string | null;
    estimated_minutes: number;
    content_uri: string | null;
  }[]>`
    SELECT id, title_key, skill_id, estimated_minutes, content_uri
    FROM training_modules
    ORDER BY skill_id, id
  `;
  return rows.map((r) => ({
    id: r.id,
    titleKey: r.title_key,
    skillId: r.skill_id,
    estimatedMinutes: r.estimated_minutes,
    contentUri: r.content_uri,
  }));
}
