/**
 * Demo-tuned personas for the Ideathon stage walk-through (Part 10).
 *
 * Three fixed synthetic personas with stable, deterministic UUIDs so that
 * URLs printed in the runbook (e.g. `/skills/employees/<aziz-id>`) stay
 * valid across re-seedings. We do NOT call `generatePerson()` for these —
 * they're hand-tuned so the live story always has the same names, the same
 * skills, and the same mentor-match ordering.
 *
 * Synthetic-data rules (CLAUDE.md non-negotiables):
 *   - Every row is tagged `synthetic = true` when inserted by seed-demo.ts.
 *   - Names are common Uzbek-style given/family names — NOT public figures.
 *   - The banned-token guard from `packages/synth-data/src/persons.ts`
 *     is re-asserted at module load (assertNoBannedTokens) so if anyone
 *     ever edits this file and accidentally types a real public figure
 *     we throw at import time, not at demo time.
 *
 * About `Dilshoda Karimovna` (the brief's display name):
 *   The spec calls for surfacing "Dilshoda Karimovna" in the UI. Read
 *   literally that's a first-name + patronymic combo (Karim + feminine
 *   suffix -ovna), NOT the surname `Karimov`/`Karimova`. However, our
 *   defense-in-depth banned-token check (below) does a substring match
 *   on lowercased fields, so the literal string `karimovna` would trip
 *   the `karimov` token. To keep the contract honest we therefore:
 *
 *     - store firstName/lastName/patronymic with NO banned substrings,
 *       and use them for the row in `employees.full_name`.
 *     - keep `displayName` as the brief's surface label, but ALSO free
 *       of banned tokens (no `Karimovna`, no `Saida...`).
 *
 *   Final shape for the mentor persona:
 *     firstName  = 'Dilshoda'
 *     lastName   = 'Bobojonova'        (common Uzbek family name)
 *     patronymic = 'Akmalovna'
 *     fullName   = 'Bobojonova Dilshoda Akmalovna'   <-- stored
 *     displayName = 'Dilshoda Bobojonova'            <-- used in UI
 *
 *   We accept a small departure from the literal "Karimovna" label in
 *   the brief in exchange for a clean banned-token guarantee. The UI
 *   layer can re-style the display name without changing this module.
 *
 * Run-once: imported by `services/api/src/demo/seed-demo.ts`.
 */

import { createHash } from 'node:crypto';
import type { Locale } from '@vitality/shared';

// ---------------------------------------------------------------------------
// Stable UUIDs
// ---------------------------------------------------------------------------

/**
 * Deterministic v5-style UUID derived from a seed string.
 *
 * Layout follows RFC 4122 v5 cosmetically (5-section dash split, version
 * nibble = 5, variant nibble in {8,9,a,b}) but we use SHA-1 over the raw
 * input rather than a namespace UUID. Good enough for demo-stable ids
 * that never collide with `gen_random_uuid()` output.
 */
export function stableUuid(input: string): string {
  const hex = createHash('sha1').update(input).digest('hex');
  // 8-4-4-4-12 split
  const a = hex.slice(0, 8);
  const b = hex.slice(8, 12);
  // Force version nibble to 5
  const c = '5' + hex.slice(13, 16);
  // Force variant nibble to one of 8/9/a/b
  const variantNibble = (parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8;
  const d = variantNibble.toString(16) + hex.slice(17, 20);
  const e = hex.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}

// ---------------------------------------------------------------------------
// Banned-token guard (re-implementation — we don't import the test-only
// export from synth-data to keep this module standalone).
// ---------------------------------------------------------------------------

const BANNED_TOKENS = [
  'karimov',
  'karimova',
  'mirziyoyev',
  'mirziyoyeva',
  'aripov',
  'inoyatov',
  'saida',
] as const;

function bannedTokensInName(name: string): string[] {
  const lower = name.toLowerCase();
  return BANNED_TOKENS.filter((t) => lower.includes(t));
}

function assertNoBannedTokens(label: string, ...fields: string[]): void {
  for (const f of fields) {
    const hit = bannedTokensInName(f);
    if (hit.length > 0) {
      throw new Error(
        `[demo/personas] persona "${label}" field "${f}" contains banned token(s) [${hit.join(', ')}]`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Persona shape
// ---------------------------------------------------------------------------

export type DemoRole = 'hr' | 'mentor' | 'newcomer';

export interface DemoPersona {
  /** Stable UUID for the row in `employees`. */
  id: string;
  /** Stored as `employees.full_name`. Lastname-first per the seeder convention. */
  fullName: string;
  /** Greeting label used by the UI / `/me` page. Brief-spec name. */
  displayName: string;
  firstName: string;
  lastName: string;
  patronymic: string;
  role: DemoRole;
  department: string;
  position: string;
  languages: Locale[];
  skills: string[];
  currentLoad: number;
  hiredAt: string; // ISO date
}

export interface DemoNewcomerExtras {
  startDate: string; // ISO date
  onboardingDeadline: string; // ISO date
  modulesTotal: number;
  modulesCompleted: number;
}

// ---------------------------------------------------------------------------
// The three personas
// ---------------------------------------------------------------------------

/** HR demo persona — runs the dashboard during Beat 4. */
export const DEMO_HR: DemoPersona = {
  id: stableUuid('vitality-demo-hr:Madina-Yusupova'),
  fullName: 'Yusupova Madina Akmalovna',
  displayName: 'Madina Yusupova',
  firstName: 'Madina',
  lastName: 'Yusupova',
  patronymic: 'Akmalovna',
  role: 'hr',
  department: 'People Operations',
  position: 'HR Business Partner',
  languages: ['ru', 'uz'],
  skills: ['HR', 'Onboarding'],
  currentLoad: 0,
  hiredAt: '2022-04-01',
};

/**
 * Mentor persona — must surface at the TOP of the mentor-picker list for
 * Aziz so the live story lands cleanly. The picker (services/api/src/hr/
 * matching.ts) weights:
 *   availability (40%)  → currentLoad = 1  (well under MAX_LOAD = 3)
 *   skillOverlap (35%)  → KYC, AML, Compliance, Risk overlap with Aziz's
 *                         target skill profile (newcomer in Compliance)
 *   languageMatch (25%) → ru+uz matches Aziz exactly
 *
 * Display label is `Dilshoda Bobojonova` — see the file header for why we
 * don't use the literal "Karimovna" form from the brief.
 */
export const DEMO_MENTOR: DemoPersona = {
  id: stableUuid('vitality-demo-mentor:Dilshoda-Bobojonova'),
  fullName: 'Bobojonova Dilshoda Akmalovna',
  displayName: 'Dilshoda Bobojonova',
  firstName: 'Dilshoda',
  lastName: 'Bobojonova',
  patronymic: 'Akmalovna',
  role: 'mentor',
  department: 'Compliance',
  position: 'Senior Compliance Specialist',
  languages: ['ru', 'uz'],
  skills: ['KYC', 'AML', 'Compliance', 'Risk'],
  currentLoad: 1,
  hiredAt: '2019-09-15',
};

/** Newcomer persona — central character of the 10-minute story. */
export const DEMO_NEWCOMER: DemoPersona = {
  id: stableUuid('vitality-demo-newcomer:Aziz-Toshmatov'),
  fullName: 'Toshmatov Aziz Bekzodovich',
  displayName: 'Aziz Toshmatov',
  firstName: 'Aziz',
  lastName: 'Toshmatov',
  patronymic: 'Bekzodovich',
  role: 'newcomer',
  department: 'Compliance',
  position: 'Junior Compliance Analyst',
  languages: ['ru', 'uz'],
  skills: ['Customer Service'],
  currentLoad: 0,
  hiredAt: '2026-05-12',
};

export const DEMO_NEWCOMER_EXTRAS: DemoNewcomerExtras = {
  startDate: '2026-05-12',
  onboardingDeadline: '2026-07-15',
  modulesTotal: 12,
  modulesCompleted: 2,
};

export const DEMO_PERSONAS: readonly DemoPersona[] = [DEMO_HR, DEMO_MENTOR, DEMO_NEWCOMER] as const;

// ---------------------------------------------------------------------------
// Load-time guard — fails noisily if anyone edits the file unsafely.
// ---------------------------------------------------------------------------

for (const p of DEMO_PERSONAS) {
  assertNoBannedTokens(
    p.displayName,
    p.firstName,
    p.lastName,
    p.patronymic,
    p.fullName,
    p.displayName,
  );
}
