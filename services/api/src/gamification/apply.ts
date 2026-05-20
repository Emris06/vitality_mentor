import { asJson, sql } from '../plugins/db';
import {
  XP_DAILY_CAP_PER_SKILL,
  badgeCriteria,
  xpForChatSolved,
  xpForModuleCompleted,
  xpForSimScored,
  type BadgeStateSnapshot,
  type XpDelta,
} from './rules';
import type { GameEvent } from './events';

/**
 * Idempotent application of a single GameEvent to the user's gamification
 * state. Called from the worker (worker.ts). Safe to call repeatedly with
 * the same event — the natural-key idempotency_key in xp_ledger means
 * replays are a no-op.
 *
 * High-level flow:
 *   1. Compute candidate XP deltas via the rules module.
 *   2. Apply the daily per-skill cap by looking up today's sum.
 *   3. Insert into xp_ledger with idempotency_key (ON CONFLICT DO NOTHING).
 *   4. Update streaks (yesterday → +1, today → no-op, else reset to 1).
 *   5. Re-evaluate badge criteria, INSERT new earns into user_badges.
 *   6. Bump matching user_quests progress; if a goal is now satisfied,
 *      mark completed and award the reward XP (as a manual-source ledger
 *      entry; the daily cap still applies to that award).
 *
 * Errors bubble up so the worker leaves the message unacked → retries.
 */
export async function applyGameEvent(event: GameEvent): Promise<void> {
  // ----- 0. Natural key for idempotency ------------------------------------
  // sim / module use their own ids; chat uses the sessionId (one award per
  // chat session). source_kind is required by the table CHECK.
  let sourceKind: 'sim' | 'chat' | 'module' | 'manual';
  let sourceId: string;
  let deltas: XpDelta[];

  switch (event.type) {
    case 'sim.scored':
      sourceKind = 'sim';
      sourceId = event.runId;
      deltas = xpForSimScored(event.score, event.scenarioId, event.mistakes ?? []);
      break;
    case 'chat.solved':
      sourceKind = 'chat';
      sourceId = event.sessionId;
      deltas = xpForChatSolved();
      break;
    case 'module.completed':
      sourceKind = 'module';
      sourceId = event.moduleId;
      deltas = xpForModuleCompleted(event.moduleId, event.score);
      break;
    default: {
      // Exhaustiveness: TS will yell if we forget a new event type.
      const _exhaustive: never = event;
      void _exhaustive;
      return;
    }
  }

  const userId = event.userId;

  // ----- 1+2+3. XP with daily cap + idempotent insert ----------------------
  for (const d of deltas) {
    await insertCappedXp(userId, d, sourceKind, sourceId);
  }

  // ----- 4. Streaks --------------------------------------------------------
  await rollStreak(userId);

  // ----- 5. Badges ---------------------------------------------------------
  await evaluateAndAwardBadges(userId);

  // ----- 6. Quests ---------------------------------------------------------
  await bumpQuests(userId, event);
}

// ===========================================================================
// XP ledger writes
// ===========================================================================

async function insertCappedXp(
  userId: string,
  d: XpDelta,
  sourceKind: 'sim' | 'chat' | 'module' | 'manual',
  sourceId: string,
): Promise<void> {
  if (d.delta === 0) return;

  // Idempotency key spans source + skill so multi-skill events (sim ≥85
  // awards KYC AND Compliance) don't collide. Reason is included so a
  // follow-up "manual" reward from the quest engine for the SAME source
  // stays unique.
  const idem = `${sourceKind}:${sourceId}:${d.skill}:${d.reason}`;

  // Cap is only enforced for POSITIVE deltas. Penalties (none today) would
  // be allowed to push below zero — the ledger is a delta log, not a clamp.
  let delta = d.delta;
  if (delta > 0) {
    const rows = await sql<{ today: string | null }[]>`
      SELECT COALESCE(SUM(delta), 0)::text AS today
      FROM xp_ledger
      WHERE user_id = ${userId}
        AND skill   = ${d.skill}
        AND created_at >= date_trunc('day', now())
    `;
    const todaySum = Number(rows[0]?.today ?? '0') || 0;
    const remaining = Math.max(0, XP_DAILY_CAP_PER_SKILL - todaySum);
    if (remaining <= 0) return;
    delta = Math.min(delta, remaining);
  }

  await sql`
    INSERT INTO xp_ledger (user_id, skill, delta, reason, source_kind, source_id, idempotency_key)
    VALUES (${userId}, ${d.skill}, ${delta}, ${d.reason}, ${sourceKind}, ${sourceId}, ${idem})
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
}

// ===========================================================================
// Streaks
// ===========================================================================

async function rollStreak(userId: string): Promise<void> {
  // Compute in SQL using ::date arithmetic so we don't drift on TZ. "Today"
  // is the API server's local date (UTC inside Docker), which matches what
  // the daily-cap window uses above.
  await sql`
    INSERT INTO streaks (user_id, current_days, longest_days, last_active_date)
    VALUES (${userId}, 1, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE
      SET
        current_days = CASE
          WHEN streaks.last_active_date = CURRENT_DATE              THEN streaks.current_days
          WHEN streaks.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_days + 1
          ELSE 1
        END,
        longest_days = GREATEST(
          streaks.longest_days,
          CASE
            WHEN streaks.last_active_date = CURRENT_DATE              THEN streaks.current_days
            WHEN streaks.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_days + 1
            ELSE 1
          END
        ),
        last_active_date = CURRENT_DATE
  `;
}

// ===========================================================================
// Badges
// ===========================================================================

async function evaluateAndAwardBadges(userId: string): Promise<void> {
  // Pull just enough state for the rules module. None of this is large for
  // Ideathon-scale demos; we re-query on every event for simplicity.
  interface RunRow { scenario_id: string; score: number; locale: string }
  const recentSimRuns = await sql<RunRow[]>`
    SELECT scenario_id, score, locale
    FROM scenario_runs
    WHERE user_id = ${userId}::text AND status = 'scored' AND score IS NOT NULL
    ORDER BY started_at DESC
    LIMIT 50
  `;

  // chatHoursToday: would need a chat_messages.user_id back-ref to compute
  // exactly. The current schema joins via chat_sessions.user_id (text). We
  // approximate by querying chat sessions owned by this user today, then
  // pulling the hours from their `user`-role messages.
  interface HourRow { h: number }
  const chatHourRows = await sql<HourRow[]>`
    SELECT EXTRACT(HOUR FROM m.created_at)::int AS h
    FROM chat_messages m
    JOIN chat_sessions s ON s.id = m.session_id
    WHERE s.user_id = ${userId}::text
      AND m.role = 'user'
      AND m.created_at >= date_trunc('day', now())
  `;

  interface StreakRow { current_days: number }
  const streakRows = await sql<StreakRow[]>`
    SELECT current_days FROM streaks WHERE user_id = ${userId} LIMIT 1
  `;
  const streakDays = streakRows[0]?.current_days ?? 0;

  const highScoreLocales = Array.from(
    new Set(recentSimRuns.filter((r) => r.score >= 70).map((r) => r.locale)),
  );

  interface BadgeRow { badge_id: string }
  const earnedRows = await sql<BadgeRow[]>`
    SELECT badge_id FROM user_badges WHERE user_id = ${userId}
  `;
  const alreadyEarned = new Set(earnedRows.map((r) => r.badge_id));

  const snapshot: BadgeStateSnapshot = {
    recentSimRuns: recentSimRuns.map((r) => ({
      scenarioId: r.scenario_id, score: r.score, locale: r.locale,
    })),
    chatHoursToday: chatHourRows.map((r) => r.h),
    streakDays,
    highScoreLocales,
    alreadyEarned,
  };

  const toAward = badgeCriteria(snapshot);
  for (const badgeId of toAward) {
    await sql`
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (${userId}, ${badgeId})
      ON CONFLICT (user_id, badge_id) DO NOTHING
    `;
  }
}

// ===========================================================================
// Quests
// ===========================================================================

interface QuestRow {
  id: string;
  kind: 'daily' | 'weekly' | 'onboarding';
  goal: Record<string, number>;
  reward_xp: number;
}

interface UserQuestRow {
  quest_id: string;
  progress: Record<string, number>;
  completed_at: Date | null;
  created_at: Date;
}

async function bumpQuests(userId: string, event: GameEvent): Promise<void> {
  // 1) Translate the event into goal-key increments.
  const inc = goalIncrementsFor(event);
  if (Object.keys(inc).length === 0) return;

  // 2) Load quest catalogue + the user's open rows in one round-trip each.
  const quests = await sql<QuestRow[]>`SELECT id, kind, goal, reward_xp FROM quests`;
  if (quests.length === 0) return;
  const userRows = await sql<UserQuestRow[]>`
    SELECT quest_id, progress, completed_at, created_at
    FROM user_quests WHERE user_id = ${userId}
  `;

  for (const q of quests) {
    // Find the relevant "open" user_quests row, scoped by quest kind window.
    const openRow = pickOpenRow(q, userRows);
    const progress: Record<string, number> = { ...(openRow?.progress ?? {}) };

    // Only count increments that this quest actually cares about.
    let changed = false;
    for (const [k, v] of Object.entries(inc)) {
      if (q.goal[k] === undefined) continue;
      progress[k] = (progress[k] ?? 0) + v;
      changed = true;
    }
    if (!changed) continue;

    // Check completion: every goal key satisfied.
    const goalMet = Object.entries(q.goal).every(([k, target]) => (progress[k] ?? 0) >= target);

    // Use a JS Date for completed_at — postgres.js binds it as timestamptz,
    // which avoids the fragment-interpolation footgun of `sql\`now()\``.
    const completedAt: Date | null = goalMet
      ? (openRow?.completed_at ?? new Date())
      : (openRow?.completed_at ?? null);

    if (openRow) {
      await sql`
        UPDATE user_quests
        SET progress = ${sql.json(asJson(progress))},
            completed_at = ${completedAt}
        WHERE user_id = ${userId}
          AND quest_id = ${q.id}
          AND created_at = ${openRow.created_at}
      `;
    } else {
      await sql`
        INSERT INTO user_quests (user_id, quest_id, progress, completed_at)
        VALUES (
          ${userId}, ${q.id},
          ${sql.json(asJson(progress))},
          ${completedAt}
        )
      `;
    }

    // Award reward XP exactly once per (quest, completion) — idempotency_key
    // dedupes if the consumer redelivers.
    if (goalMet && (!openRow || !openRow.completed_at) && q.reward_xp > 0) {
      // Source id encodes the completion instant via the quest id; we use the
      // user+quest as the unique tuple so a repeat of the same quest (daily)
      // on a fresh row gets a fresh idempotency_key. created_at differs per
      // row, so we include it.
      const sourceId = `${q.id}:${(openRow?.created_at ?? new Date()).toISOString()}`;
      await insertCappedXp(
        userId,
        { skill: 'Research', delta: q.reward_xp, reason: `quest.completed:${q.id}` },
        'manual',
        sourceId,
      );
    }
  }
}

/** What goal keys does this event bump? Names match QUESTS_SEED.goal keys. */
function goalIncrementsFor(event: GameEvent): Record<string, number> {
  switch (event.type) {
    case 'sim.scored': {
      const inc: Record<string, number> = { simScored: 1 };
      if (event.scenarioId === 'kyc') inc.simScoredKyc = 1;
      return inc;
    }
    case 'chat.solved':
      return { chatSolved: 1 };
    case 'module.completed':
      return { moduleCompleted: 1 };
  }
}

/**
 * Pick the user_quests row that is still "open" for this quest's window.
 *   - daily: created today (UTC)
 *   - weekly: created in the last 7 days
 *   - onboarding: any incomplete row
 * Returns the most recent matching row, or undefined → insert a fresh one.
 */
function pickOpenRow(q: QuestRow, rows: UserQuestRow[]): UserQuestRow | undefined {
  const mine = rows.filter((r) => r.quest_id === q.id);
  const now = Date.now();
  for (const r of mine) {
    if (r.completed_at) continue;
    const ageMs = now - r.created_at.getTime();
    if (q.kind === 'daily' && ageMs < 24 * 60 * 60 * 1000) return r;
    if (q.kind === 'weekly' && ageMs < 7 * 24 * 60 * 60 * 1000) return r;
    if (q.kind === 'onboarding') return r;
  }
  return undefined;
}
