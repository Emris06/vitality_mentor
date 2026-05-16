import type { Employee, Newcomer } from '@vitality/shared';

/**
 * Mentor matching algorithm.
 *
 * Three weighted, normalized signals (each in [0, 1]) combine into a single
 * score on a 0-100 scale. The breakdown is exposed as `reasons[]` so HR can
 * see *why* a mentor surfaced — this is the "transparent matching" call-out
 * in the brief. We deliberately keep the weights configurable here so an
 * HR lead can tweak them later without touching route code.
 *
 * TODO(i18n): reasons are emitted in English only for this iteration.
 *             Translate to ru/uz once the HR UI ships its i18n bundle.
 */

export interface MatchScore {
  mentorId: string;
  score: number;
  reasons: string[];
}

const WEIGHTS = {
  availability: 0.4,
  skillOverlap: 0.35,
  languageMatch: 0.25,
} as const;

/** Mentors above this load are still considered but heavily penalised. */
const MAX_LOAD_FOR_AVAILABILITY = 3;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function intersection<T>(a: readonly T[], b: readonly T[]): T[] {
  const bs = new Set(b);
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of a) {
    if (bs.has(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function scoreMentor(mentor: Employee, newcomer: Newcomer): MatchScore {
  // --- availability -------------------------------------------------------
  const availability = 1 - clamp01(mentor.currentLoad / MAX_LOAD_FOR_AVAILABILITY);
  const availabilityReason =
    `Mentor has ${mentor.currentLoad} active newcomer${mentor.currentLoad === 1 ? '' : 's'}`;

  // --- skill overlap ------------------------------------------------------
  const sharedSkills = intersection(mentor.skills, newcomer.skills);
  const skillOverlap = sharedSkills.length / Math.max(1, newcomer.skills.length);
  const skillReason = sharedSkills.length > 0
    ? `Shares ${sharedSkills.length} skill${sharedSkills.length === 1 ? '' : 's'} (${sharedSkills.slice(0, 5).join(', ')})`
    : 'No overlapping skills';

  // --- language match -----------------------------------------------------
  const sharedLangs = intersection(mentor.languages, newcomer.languages);
  const languageMatch = sharedLangs.length / Math.max(1, newcomer.languages.length);
  const languageReason = sharedLangs.length > 0
    ? `Speaks ${sharedLangs.join(', ')}`
    : 'No shared languages';

  const raw =
    WEIGHTS.availability * availability +
    WEIGHTS.skillOverlap * skillOverlap +
    WEIGHTS.languageMatch * languageMatch;

  const score = Math.round(clamp01(raw) * 100);

  return {
    mentorId: mentor.id,
    score,
    reasons: [availabilityReason, skillReason, languageReason],
  };
}

/**
 * Top `n` mentors ranked by score (desc). Ties broken by mentorId asc so the
 * ordering is stable across calls — important when the UI diffs two
 * /match responses.
 */
export function bestMatches(
  mentors: readonly Employee[],
  newcomer: Newcomer,
  n = 5,
): MatchScore[] {
  const scored = mentors.map((m) => scoreMentor(m, newcomer));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.mentorId.localeCompare(b.mentorId);
  });
  return scored.slice(0, n);
}
