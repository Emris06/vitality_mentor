/**
 * Gamification rules — pure functions, no I/O.
 *
 * These functions compute "what would happen" without touching Postgres or
 * Redis. apply.ts is the only place that writes; this file is unit-testable
 * in isolation.
 *
 * Skill names are free-form strings; we align them with the BANKING_SKILLS
 * vocabulary used in hr/seed.ts (e.g. "KYC", "Compliance"). The rules engine
 * doesn't validate them — apply.ts just writes whatever we return.
 */

export interface XpDelta {
  skill: string;
  delta: number;
  reason: string;
}

/** Anti-cheese: a single (user, skill) can accumulate at most this many XP
 *  points per UTC day. apply.ts enforces this clamp by reading today's sum
 *  before each insert. Manual-source XP counts against the cap too. */
export const XP_DAILY_CAP_PER_SKILL = 60;

// ----- Sim scored ----------------------------------------------------------

export interface SimMistake {
  stepId?: string;
  code?: string;
  penalty: number;
}

/**
 * KYC-scenario-shaped reward curve:
 *   score ≥ 85 → +25 KYC, +10 Compliance
 *   60..84    → +12 KYC
 *   < 60      → +4 KYC
 * Mistakes subtract sum(penalty)/2, clamped to ≤ 8, from the KYC delta.
 *
 * The catalog of "skill per scenario" is a TODO — for now we treat every
 * sim run as a KYC-skill run because that's the only implemented scenario.
 */
export function xpForSimScored(score: number, mistakes: SimMistake[] = []): XpDelta[] {
  const out: XpDelta[] = [];
  if (score >= 85) {
    out.push({ skill: 'KYC', delta: 25, reason: `sim.scored:${score}` });
    out.push({ skill: 'Compliance', delta: 10, reason: `sim.scored:${score}` });
  } else if (score >= 60) {
    out.push({ skill: 'KYC', delta: 12, reason: `sim.scored:${score}` });
  } else {
    out.push({ skill: 'KYC', delta: 4, reason: `sim.scored:${score}` });
  }

  const rawPenalty = mistakes.reduce((acc, m) => acc + (Number(m.penalty) || 0), 0);
  const penalty = Math.min(8, Math.floor(rawPenalty / 2));
  if (penalty > 0) {
    // Apply to KYC only — Compliance bonus survives if any.
    const kyc = out.find((d) => d.skill === 'KYC');
    if (kyc) {
      kyc.delta = Math.max(0, kyc.delta - penalty);
      kyc.reason = `${kyc.reason}|penalty:${penalty}`;
    }
  }

  // Drop zero/negative entries — no point cluttering the ledger.
  return out.filter((d) => d.delta > 0);
}

// ----- Chat solved ---------------------------------------------------------

/** A chat session whose user message produced a grounded answer is worth a
 *  symbolic +1 in "Research". The chat route doesn't actually emit this yet
 *  (TODO: wire after we add a "solved" signal from the AI service). */
export function xpForChatSolved(): XpDelta[] {
  return [{ skill: 'Research', delta: 1, reason: 'chat.solved' }];
}

// ----- Module completed ----------------------------------------------------

/**
 * Module XP defaults to +20 on the inferred skill. We infer the skill from
 * the module-id prefix (everything before the first "_" or "-"), capitalised
 * for cosmetic match with BANKING_SKILLS. Real catalog mapping is a TODO.
 */
export function xpForModuleCompleted(moduleId: string, _score: number): XpDelta[] {
  const head = moduleId.split(/[_\-:]/)[0] ?? moduleId;
  const skill = head.length > 0 ? head[0]!.toUpperCase() + head.slice(1) : 'General';
  return [{ skill, delta: 20, reason: `module.completed:${moduleId}` }];
}

// ----- Badge criteria ------------------------------------------------------

/**
 * Snapshot of a user's gamification state from the DB; rules.badgeCriteria
 * inspects this and returns ids of badges that should be awarded *now*. The
 * applier diffs against `alreadyEarned` to avoid duplicate awards (the
 * user_badges primary key would catch dupes anyway, but we short-circuit).
 */
export interface BadgeStateSnapshot {
  /** scenario runs scored by this user, newest first */
  recentSimRuns: Array<{ scenarioId: string; score: number; locale: string }>;
  /** Hours-of-day (0..23 local) at which the user submitted chat questions today. */
  chatHoursToday: number[];
  /** Current streak length in days. */
  streakDays: number;
  /** Distinct locales in which the user has scored ≥ 70 on any sim run. */
  highScoreLocales: string[];
  /** Set of badge ids the user already has. */
  alreadyEarned: Set<string>;
}

export function badgeCriteria(state: BadgeStateSnapshot): string[] {
  const earned: string[] = [];
  const has = (id: string) => state.alreadyEarned.has(id) || earned.includes(id);

  // first_kyc — any scored KYC run.
  if (!has('first_kyc') && state.recentSimRuns.some((r) => r.scenarioId === 'kyc')) {
    earned.push('first_kyc');
  }

  // kyc_perfectionist — KYC score ≥ 95.
  if (
    !has('kyc_perfectionist') &&
    state.recentSimRuns.some((r) => r.scenarioId === 'kyc' && r.score >= 95)
  ) {
    earned.push('kyc_perfectionist');
  }

  // night_owl — 3+ chat questions after 22:00 local on the same day.
  if (!has('night_owl') && state.chatHoursToday.filter((h) => h >= 22).length >= 3) {
    earned.push('night_owl');
  }

  // streak_7
  if (!has('streak_7') && state.streakDays >= 7) {
    earned.push('streak_7');
  }

  // polyglot — score ≥ 70 in two distinct locales.
  if (!has('polyglot') && new Set(state.highScoreLocales).size >= 2) {
    earned.push('polyglot');
  }

  return earned;
}

// ----- Seed catalogues ------------------------------------------------------

export interface BadgeSeed {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  criteria: Record<string, unknown>;
}

export const BADGES_SEED: BadgeSeed[] = [
  {
    id: 'first_kyc',
    nameKey: 'badges.first_kyc.name',
    descriptionKey: 'badges.first_kyc.desc',
    icon: 'shield-check',
    criteria: { kind: 'simScenarioCompleted', scenarioId: 'kyc' },
  },
  {
    id: 'kyc_perfectionist',
    nameKey: 'badges.kyc_perfectionist.name',
    descriptionKey: 'badges.kyc_perfectionist.desc',
    icon: 'star',
    criteria: { kind: 'simScoreAtLeast', scenarioId: 'kyc', score: 95 },
  },
  {
    id: 'night_owl',
    nameKey: 'badges.night_owl.name',
    descriptionKey: 'badges.night_owl.desc',
    icon: 'moon',
    criteria: { kind: 'chatAfterHour', hour: 22, count: 3 },
  },
  {
    id: 'streak_7',
    nameKey: 'badges.streak_7.name',
    descriptionKey: 'badges.streak_7.desc',
    icon: 'flame',
    criteria: { kind: 'streakDays', days: 7 },
  },
  {
    id: 'polyglot',
    nameKey: 'badges.polyglot.name',
    descriptionKey: 'badges.polyglot.desc',
    icon: 'languages',
    criteria: { kind: 'highScoreInLocales', minScore: 70, distinctLocales: 2 },
  },
];

export interface QuestSeed {
  id: string;
  nameKey: string;
  descriptionKey: string;
  kind: 'daily' | 'weekly' | 'onboarding';
  goal: Record<string, number>;
  rewardXp: number;
}

export const QUESTS_SEED: QuestSeed[] = [
  {
    id: 'daily_chat_3',
    nameKey: 'quests.daily_chat_3.name',
    descriptionKey: 'quests.daily_chat_3.desc',
    kind: 'daily',
    goal: { chatSolved: 3 },
    rewardXp: 8,
  },
  {
    id: 'weekly_sim_2',
    nameKey: 'quests.weekly_sim_2.name',
    descriptionKey: 'quests.weekly_sim_2.desc',
    kind: 'weekly',
    goal: { simScored: 2 },
    rewardXp: 24,
  },
  {
    id: 'onboarding_first_kyc',
    nameKey: 'quests.onboarding_first_kyc.name',
    descriptionKey: 'quests.onboarding_first_kyc.desc',
    kind: 'onboarding',
    goal: { simScoredKyc: 1 },
    rewardXp: 30,
  },
];
