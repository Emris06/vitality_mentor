/**
 * HR demo seeder.
 *
 * Wipes prior `synthetic = true` rows, then inserts a deterministic cohort:
 *   - 5 HR, 10 mentors, 15 individual contributors → 30 employees
 *   - 8 newcomers (added on top of the 30 so we have 38 employee rows total)
 *
 * Deterministic via the `vitality-demo` seed → repeatable for screenshots.
 *
 * Run from `services/api/`:  pnpm db:seed:hr
 */

import { seedRng, generatePerson } from '@vitality/synth-data';
import type { Locale } from '@vitality/shared';
import { sql } from '../plugins/db';
import { BADGES_SEED, QUESTS_SEED } from '../gamification/rules';

const BANKING_SKILLS = [
  'KYC', 'AML', 'Accounts', 'Deposits', 'Transfers',
  'Compliance', 'Customer Service', 'Risk', 'FX', 'Loans',
] as const;

const DEPARTMENTS = [
  'Retail Banking', 'Compliance', 'Operations', 'Customer Service',
  'Risk Management', 'Treasury',
];

const POSITIONS_BY_ROLE: Record<string, string[]> = {
  hr: ['HR Manager', 'HR Business Partner', 'Onboarding Lead'],
  mentor: ['Senior Banking Specialist', 'Team Lead', 'Operations Manager'],
  employee: ['Banking Specialist', 'Operations Officer', 'Compliance Analyst'],
  newcomer: ['Junior Banking Specialist', 'Trainee Operations Officer'],
};

function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0] as T);
  }
  return out;
}

function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function languagesFor(rng: () => number, role: 'mentor' | 'other' | 'newcomer'): Locale[] {
  if (role === 'mentor') {
    // Every mentor speaks ru; half also speak uz; a third also speak en.
    const langs: Locale[] = ['ru'];
    if (rng() < 0.5) langs.push('uz');
    if (rng() < 1 / 3) langs.push('en');
    return langs;
  }
  if (role === 'newcomer') {
    // 1-2 languages per newcomer, biased to ru/uz.
    const pool: Locale[] = ['ru', 'uz', 'en'];
    const n = 1 + Math.floor(rng() * 2);
    return pickN(rng, pool, n);
  }
  // Other employees — at least ru.
  const langs: Locale[] = ['ru'];
  if (rng() < 0.4) langs.push('uz');
  return langs;
}

interface EmployeeInsert {
  full_name: string;
  role: 'hr' | 'mentor' | 'newcomer' | 'employee' | 'admin';
  department: string;
  position: string;
  languages: Locale[];
  skills: string[];
  hired_at: string;
}

async function main(): Promise<void> {
  const rng = seedRng('vitality-demo');

  // Build employee rows ------------------------------------------------------
  const employees: EmployeeInsert[] = [];

  const make = (
    role: EmployeeInsert['role'],
    count: number,
    skillRange: [number, number],
    langRole: 'mentor' | 'other' | 'newcomer',
  ) => {
    for (let i = 0; i < count; i++) {
      const person = generatePerson(`vitality-${role}-${i}`);
      const skillCount = skillRange[0] + Math.floor(rng() * (skillRange[1] - skillRange[0] + 1));
      employees.push({
        full_name: person.fullName,
        role,
        department: pickOne(rng, DEPARTMENTS),
        position: pickOne(rng, POSITIONS_BY_ROLE[role] ?? ['Specialist']),
        languages: languagesFor(rng, langRole),
        skills: pickN(rng, BANKING_SKILLS, skillCount),
        hired_at: isoDateOffset(-Math.floor(rng() * 2000) - 30),
      });
    }
  };

  make('hr', 5, [1, 2], 'other');
  make('mentor', 10, [3, 6], 'mentor');
  make('employee', 15, [2, 4], 'other');
  make('newcomer', 8, [1, 3], 'newcomer');

  console.log(`[seed:hr] preparing ${employees.length} employees`);

  // Wipe prior synthetic rows ------------------------------------------------
  // ON DELETE CASCADE on newcomers + ON UPDATE no-op for assignments means
  // we just need to nuke the dependent tables first.
  await sql.begin(async (tx) => {
    await tx`DELETE FROM mentor_assignments WHERE mentor_id IN (SELECT id FROM employees WHERE synthetic = true)`;
    await tx`DELETE FROM newcomers WHERE employee_id IN (SELECT id FROM employees WHERE synthetic = true)`;
    await tx`DELETE FROM employees WHERE synthetic = true`;
  });
  console.log('[seed:hr] wiped prior synthetic rows');

  // Insert employees, capture ids, then insert newcomer rows -----------------
  await sql.begin(async (tx) => {
    interface InsertedRow { id: string; role: string }
    const inserted: InsertedRow[] = [];
    for (const e of employees) {
      const rows = await tx<InsertedRow[]>`
        INSERT INTO employees
          (full_name, role, department, position, languages, current_load, skills, hired_at, synthetic)
        VALUES
          (${e.full_name}, ${e.role}, ${e.department}, ${e.position},
           ${e.languages as unknown as string[]}, 0,
           ${e.skills as unknown as string[]}, ${e.hired_at}, true)
        RETURNING id, role
      `;
      const row = rows[0];
      if (!row) throw new Error('insert returned no row');
      inserted.push(row);
    }

    // Newcomer rows: pair each `role='newcomer'` employee with start/deadline.
    let ncIdx = 0;
    for (const row of inserted) {
      if (row.role !== 'newcomer') continue;
      const startOffset = -Math.floor(rng() * 30);
      const start = isoDateOffset(startOffset);
      const deadline = isoDateOffset(startOffset + 60);
      const completed = Math.floor(rng() * 8);
      await tx`
        INSERT INTO newcomers (employee_id, start_date, onboarding_deadline, modules_completed, modules_total)
        VALUES (${row.id}, ${start}, ${deadline}, ${completed}, 12)
      `;
      ncIdx++;
    }
    console.log(`[seed:hr] inserted ${inserted.length} employees, ${ncIdx} newcomer rows`);
  });

  // Gamification catalogues. Idempotent upserts: re-running the seeder is
  // safe and will pick up any edits to BADGES_SEED / QUESTS_SEED. We do NOT
  // touch user_badges / user_quests — those are populated lazily by
  // gamification/apply.ts on the first real event for each user.
  await sql.begin(async (tx) => {
    for (const b of BADGES_SEED) {
      await tx`
        INSERT INTO badges (id, name_key, description_key, icon, criteria)
        VALUES (${b.id}, ${b.nameKey}, ${b.descriptionKey}, ${b.icon},
                ${tx.json(b.criteria as unknown as object)})
        ON CONFLICT (id) DO UPDATE
          SET name_key = EXCLUDED.name_key,
              description_key = EXCLUDED.description_key,
              icon = EXCLUDED.icon,
              criteria = EXCLUDED.criteria
      `;
    }
    for (const q of QUESTS_SEED) {
      await tx`
        INSERT INTO quests (id, name_key, description_key, kind, goal, reward_xp)
        VALUES (${q.id}, ${q.nameKey}, ${q.descriptionKey}, ${q.kind},
                ${tx.json(q.goal as unknown as object)}, ${q.rewardXp})
        ON CONFLICT (id) DO UPDATE
          SET name_key = EXCLUDED.name_key,
              description_key = EXCLUDED.description_key,
              kind = EXCLUDED.kind,
              goal = EXCLUDED.goal,
              reward_xp = EXCLUDED.reward_xp
      `;
    }
  });
  console.log(`[seed:hr] upserted ${BADGES_SEED.length} badges, ${QUESTS_SEED.length} quests`);

  console.log('[seed:hr] done');
}

main()
  .then(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed:hr] failed', err);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });
