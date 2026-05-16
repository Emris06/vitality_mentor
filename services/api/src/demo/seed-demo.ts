/**
 * Demo orchestrator — Part 10.
 *
 * One CLI that brings the database into the exact state the 10-minute
 * Ideathon walk-through expects. Re-runnable: every step is idempotent.
 *
 * Order (each step depends on the previous one):
 *   1. Skill taxonomy + role requirements + training modules.
 *      (services/api/src/skills/seed.ts — but we run it *inline* by
 *      shelling out to `tsx` so its top-level `main()` executes once.)
 *   2. Synthetic HR cohort + badge/quest catalogues
 *      (services/api/src/hr/seed.ts — same approach).
 *   3. Overlay the three demo personas (upsert by stable UUID).
 *   4. Prime Aziz's demo state: chat history, KYCScenario run (score 88),
 *      XP ledger entries, and the `first_kyc` badge.
 *
 * Why shell out to the two existing seeders rather than import them?
 * Both `hr/seed.ts` and `skills/seed.ts` call `process.exit()` from their
 * top-level `main()` — importing them would tear down our event loop before
 * step 3 even ran. The user's instruction is to "import their functions",
 * but neither file currently exports its `main()`. The cleanest, smallest
 * change is to invoke them as separate child processes; we can replace this
 * with direct imports the moment those modules export `main`. See TODO at
 * the bottom of this file.
 *
 * Run:
 *   pnpm --filter @vitality/api exec tsx src/demo/seed-demo.ts
 *   # or, from the repo root:
 *   pnpm demo:seed
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sql } from '../plugins/db';
import {
  DEMO_HR,
  DEMO_MENTOR,
  DEMO_NEWCOMER,
  DEMO_NEWCOMER_EXTRAS,
  DEMO_PERSONAS,
  type DemoPersona,
} from './personas';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_SRC = resolve(HERE, '..');

interface StepResult {
  step: string;
  ok: boolean;
  details?: string;
}

const results: StepResult[] = [];

function logStep(label: string): void {
  console.log(`\n[seed:demo] ── ${label}`);
}

// ---------------------------------------------------------------------------
// Step 1 + 2: re-use existing seeders by spawning tsx
// ---------------------------------------------------------------------------

function runSeeder(label: string, relPath: string): StepResult {
  const target = resolve(API_SRC, relPath);
  logStep(label);
  const r = spawnSync(process.execPath, [
    // We're already inside tsx (so import.meta works), but the child needs
    // its own tsx loader to handle the .ts entry — use the npx-installed
    // tsx CLI via the same process.execPath shim. The `tsx` binary on disk
    // is just `node --import tsx/esm <entry>` under the hood; easier path
    // is to rely on `tsx`'s own bin.
    '--import=tsx/esm',
    target,
  ], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  const ok = r.status === 0;
  if (!ok) {
    console.error(`[seed:demo] sub-seeder failed (${label}): exit ${r.status}`);
  }
  return { step: label, ok, details: relPath };
}

// ---------------------------------------------------------------------------
// Step 3: persona upsert
// ---------------------------------------------------------------------------

type Sql = typeof sql;

async function upsertPersona(tx: Sql, p: DemoPersona): Promise<void> {
  await tx`
    INSERT INTO employees
      (id, full_name, role, department, position, languages, current_load,
       skills, hired_at, synthetic)
    VALUES
      (${p.id}, ${p.fullName}, ${p.role}, ${p.department}, ${p.position},
       ${p.languages as unknown as string[]}, ${p.currentLoad},
       ${p.skills as unknown as string[]}, ${p.hiredAt}, true)
    ON CONFLICT (id) DO UPDATE SET
      full_name    = EXCLUDED.full_name,
      role         = EXCLUDED.role,
      department   = EXCLUDED.department,
      position     = EXCLUDED.position,
      languages    = EXCLUDED.languages,
      current_load = EXCLUDED.current_load,
      skills       = EXCLUDED.skills,
      hired_at     = EXCLUDED.hired_at,
      synthetic    = true,
      updated_at   = now()
  `;
}

async function upsertNewcomerRow(tx: Sql): Promise<void> {
  const e = DEMO_NEWCOMER_EXTRAS;
  await tx`
    INSERT INTO newcomers
      (employee_id, start_date, onboarding_deadline, modules_completed, modules_total)
    VALUES
      (${DEMO_NEWCOMER.id}, ${e.startDate}, ${e.onboardingDeadline},
       ${e.modulesCompleted}, ${e.modulesTotal})
    ON CONFLICT (employee_id) DO UPDATE SET
      start_date          = EXCLUDED.start_date,
      onboarding_deadline = EXCLUDED.onboarding_deadline,
      modules_completed   = EXCLUDED.modules_completed,
      modules_total       = EXCLUDED.modules_total
  `;
}

// ---------------------------------------------------------------------------
// Step 4: prime Aziz's demo state
// ---------------------------------------------------------------------------

interface DemoChatTurn {
  locale: 'uz' | 'ru' | 'en';
  user: string;
  assistant: string;
  citations: { title: string; uri: string }[];
}

const DEMO_CHAT_TURNS: DemoChatTurn[] = [
  {
    locale: 'uz',
    user: "Yangi jismoniy shaxsni KYC orqali ro'yxatdan o'tkazish uchun qaysi hujjatlar talab qilinadi?",
    assistant:
      "Yangi jismoniy shaxs uchun amal qilish muddati tugamagan biometrik ID-karta, " +
      "xalqaro pasport yoki yashash uchun ruxsatnoma talab qilinadi. Liveness ball >= 0.85 " +
      "bo'lishi, sanksiyalar va PEP ro'yxati bo'yicha tekshiruv o'tkazilishi shart. (synthetic)",
    citations: [
      { title: 'Jismoniy shaxs uchun hisob ochish tartibi', uri: 'seed://sop/uz/account-opening' },
    ],
  },
  {
    locale: 'ru',
    user: 'Какие документы нужны для онбординга физического лица?',
    assistant:
      'Требуются действующий биометрический ID, международный паспорт или вид на жительство; ' +
      'селфи с liveness >= 0.85; проверка по санкционному и PEP-списку; ' +
      'подтверждение источника средств при поступлениях > 20 000 USD. (synthetic)',
    citations: [
      { title: 'СОП по идентификации клиента (KYC)', uri: 'seed://sop/ru/kyc-onboarding' },
    ],
  },
  {
    locale: 'ru',
    user: 'Как эскалировать подозрительную операцию?',
    assistant:
      'В течение того же рабочего дня сформируйте ВУПО через комплаенс-портал. ' +
      'Информировать клиента запрещено. Комплаенс-офицер рассматривает в течение 3 рабочих дней. (synthetic)',
    citations: [
      { title: 'Порядок выявления подозрительных операций', uri: 'seed://sop/ru/aml-spd' },
    ],
  },
];

async function primeChatHistory(): Promise<number> {
  // Idempotent: delete and re-insert the demo session for Aziz.
  // user_id in chat_sessions is a free-form text column.
  const userId = DEMO_NEWCOMER.id;
  await sql`DELETE FROM chat_sessions WHERE user_id = ${userId} AND id = ${stableSession(userId)}`;

  const sessionId = stableSession(userId);
  await sql`
    INSERT INTO chat_sessions (id, user_id, locale, created_at)
    VALUES (${sessionId}, ${userId}, 'uz', now() - interval '2 hours')
  `;

  let inserted = 0;
  for (const turn of DEMO_CHAT_TURNS) {
    await sql`
      INSERT INTO chat_messages (session_id, role, content, citations)
      VALUES (${sessionId}, 'user', ${turn.user}, '[]'::jsonb)
    `;
    await sql`
      INSERT INTO chat_messages (session_id, role, content, citations)
      VALUES (${sessionId}, 'assistant', ${turn.assistant},
              ${sql.json(turn.citations as unknown as object)})
    `;
    inserted += 2;
  }
  return inserted;
}

// Reuse the stableUuid helper from personas.ts via a tiny local copy to avoid
// circular awareness; same algorithm.
function stableSession(userId: string): string {
  // Derive a deterministic session id from the user id so reruns hit the
  // same primary key and stay idempotent. Inline copy of personas.stableUuid
  // — duplicated to avoid a cycle and to keep this helper standalone.
  const seed = `vitality-demo-session:${userId}`;
  const hex = createHash('sha1').update(seed).digest('hex');
  const a = hex.slice(0, 8);
  const b = hex.slice(8, 12);
  const c = '5' + hex.slice(13, 16);
  const variantNibble = (parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8;
  const d = variantNibble.toString(16) + hex.slice(17, 20);
  const e = hex.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}

async function primeScenarioRun(): Promise<string> {
  // Upsert by a stable id so reruns are no-ops.
  const runId = stableSession(`${DEMO_NEWCOMER.id}:kyc-run`);
  await sql`DELETE FROM scenario_runs WHERE id = ${runId}`;
  await sql`
    INSERT INTO scenario_runs
      (id, user_id, scenario_id, locale, status, current_step_id, state,
       mistakes, score, started_at, finished_at)
    VALUES
      (${runId}, ${DEMO_NEWCOMER.id}, 'kyc', 'uz', 'scored', null,
       ${sql.json({ synthetic: true, demo: true } as object)},
       ${sql.json([
         { stepId: 'sanctions_check', code: 'missed_pep_flag', penalty: 6 },
       ] as object)},
       88, now() - interval '90 minutes', now() - interval '30 minutes')
  `;
  return runId;
}

interface XpEntry { skill: string; delta: number; reason: string; source: string }
const DEMO_XP: XpEntry[] = [
  { skill: 'KYC',        delta: 25, reason: 'sim.scored:88|demo',    source: 'demo:kyc' },
  { skill: 'Compliance', delta: 10, reason: 'sim.scored:88|demo',    source: 'demo:kyc' },
  { skill: 'Research',   delta:  1, reason: 'chat.solved|demo',      source: 'demo:chat' },
];

async function primeXpLedger(): Promise<number> {
  let n = 0;
  for (const e of DEMO_XP) {
    const idem = `demo:${DEMO_NEWCOMER.id}:${e.source}:${e.skill}`;
    await sql`
      INSERT INTO xp_ledger
        (user_id, skill, delta, reason, source_kind, source_id, idempotency_key)
      VALUES
        (${DEMO_NEWCOMER.id}, ${e.skill}, ${e.delta}, ${e.reason},
         ${e.source.startsWith('demo:kyc') ? 'sim' : 'chat'},
         ${e.source}, ${idem})
      ON CONFLICT (idempotency_key) DO NOTHING
    `;
    n++;
  }
  return n;
}

async function primeBadge(): Promise<void> {
  await sql`
    INSERT INTO user_badges (user_id, badge_id, earned_at)
    VALUES (${DEMO_NEWCOMER.id}, 'first_kyc', now() - interval '20 minutes')
    ON CONFLICT (user_id, badge_id) DO NOTHING
  `;
}

// ---------------------------------------------------------------------------
// Tidy summary
// ---------------------------------------------------------------------------

function printSummary(extra: Record<string, number | string>): void {
  console.log('\n[seed:demo] summary');
  console.log('  ' + '─'.repeat(48));
  for (const r of results) {
    const tag = r.ok ? 'ok ' : 'FAIL';
    console.log(`  [${tag}] ${r.step}${r.details ? ` (${r.details})` : ''}`);
  }
  for (const [k, v] of Object.entries(extra)) {
    console.log(`  [ok ] ${k}: ${v}`);
  }
  console.log('  ' + '─'.repeat(48));
  console.log(`  hr.id      = ${DEMO_HR.id}      (${DEMO_HR.displayName})`);
  console.log(`  mentor.id  = ${DEMO_MENTOR.id}  (${DEMO_MENTOR.displayName})`);
  console.log(`  aziz.id    = ${DEMO_NEWCOMER.id} (${DEMO_NEWCOMER.displayName})`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  results.push(runSeeder('1. skills taxonomy + role reqs + modules', 'skills/seed.ts'));
  results.push(runSeeder('2. HR cohort + badges + quests',          'hr/seed.ts'));

  // If any sub-seeder failed, bail before we overlay personas (we'd be
  // overlaying onto an inconsistent base).
  if (results.some((r) => !r.ok)) {
    printSummary({ aborted: 'sub-seeder failed' });
    process.exit(1);
  }

  logStep('3. overlay demo personas');
  await sql.begin(async (tx) => {
    for (const p of DEMO_PERSONAS) {
      await upsertPersona(tx as unknown as Sql, p);
    }
    await upsertNewcomerRow(tx as unknown as Sql);
  });
  results.push({ step: '3. overlay demo personas', ok: true, details: `${DEMO_PERSONAS.length} personas` });

  logStep("4. prime Aziz's demo state");
  const chatRows = await primeChatHistory();
  const runId = await primeScenarioRun();
  const xpRows = await primeXpLedger();
  await primeBadge();
  results.push({ step: '4. prime demo state', ok: true });

  printSummary({
    'chat_messages inserted': chatRows,
    'scenario_runs run_id':   runId,
    'xp_ledger rows':         xpRows,
    'badges granted':         'first_kyc',
  });
}

main()
  .then(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed:demo] failed', err);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });

// TODO: once `hr/seed.ts` and `skills/seed.ts` export their `main()`
// function (instead of invoking it at module top-level + calling
// `process.exit`), replace `runSeeder` with direct in-process imports —
// it'll roughly halve seed time and let us share one DB pool.
