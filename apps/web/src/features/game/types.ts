/**
 * Local view types for the gamification HTTP surface.
 *
 * The backend contract is owned by a parallel agent — these types follow the
 * documented response shape. If the shared package grows a `gamification.ts`
 * later, swap these for the canonical re-export.
 */

/** XP totals per skill key (e.g. `{ kyc: 230, compliance: 90 }`). */
export type XpBySkill = Record<string, number>;

export interface Badge {
  id: string;
  /** i18n key under `game.badges.<id>.name`. */
  nameKey: string;
  /** i18n key under `game.badges.<id>.description`. */
  descriptionKey: string;
  /** Emoji shortcode or icon hint from the backend; we map by id below. */
  icon: string;
  /** ISO-8601 timestamp. Absent for locked badges in some payload shapes. */
  earnedAt?: string;
}

/** Locked variant used by the UI to render a greyscale placeholder tile. */
export interface BadgeSlot {
  id: string;
  earned: boolean;
  /** Present iff `earned === true`. */
  earnedAt?: string;
}

export type QuestKind = 'daily' | 'weekly' | 'onboarding';

/**
 * The `goal` and `progress` payloads are intentionally untyped — the backend
 * stores quest-shaped metadata as free-form maps so it can ship new quest
 * kinds without front-end changes. The UI renders the first numeric key pair.
 */
export interface Quest {
  id: string;
  kind: QuestKind;
  nameKey: string;
  descriptionKey: string;
  goal: Record<string, number>;
  progress: Record<string, number>;
  rewardXp: number;
  /** ISO timestamp; presence means the quest is done. */
  completedAt?: string;
}

export interface Streak {
  current: number;
  longest: number;
  /** ISO date (YYYY-MM-DD or full ISO) of the last activity that counted. */
  lastActiveDate?: string;
}

export interface GameProfile {
  xpBySkill: XpBySkill;
  badges: Badge[];
  streak: Streak;
  todayQuest: Quest | null;
  /**
   * Optional — not in the documented `/me` response. When the HR endpoint
   * exposes it we can wire it through; for now `DeadlineRing` uses a stub.
   */
  onboardingDeadline?: string;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  xp: number;
}

/** The fixed badge catalog used to render the BadgeWall when locked. */
export const KNOWN_BADGES: ReadonlyArray<{ id: string; icon: string }> = [
  { id: 'first_kyc', icon: '🛡️' },
  { id: 'kyc_perfectionist', icon: '💎' },
  { id: 'night_owl', icon: '🌙' },
  { id: 'streak_7', icon: '🔥' },
  { id: 'polyglot', icon: '🌍' },
  { id: 'first_deposit', icon: '💳' },
  { id: 'first_transfer', icon: '🔁' },
];

/** Skill keys we surface in the leaderboard filter. Free-form; backend may add more. */
export const KNOWN_SKILLS: ReadonlyArray<string> = ['kyc', 'compliance', 'customer_service'];
