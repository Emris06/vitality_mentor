-- 004_gamification.sql
-- Gamification surface: XP ledger, badges, quests, streaks.
-- Idempotent: safe to re-apply. All table/index DDL uses IF NOT EXISTS.
--
-- Design notes:
--   * xp_ledger is append-only. The applier (gamification/apply.ts) writes one
--     row per (event, skill) tuple and uses idempotency_key (UNIQUE) to dedupe
--     replays from the at-least-once Redis Stream consumer.
--   * badges / quests are static catalogues seeded from src/hr/seed.ts; user_*
--     join tables track per-user earn state.
--   * streaks is one row per user; rolled forward by apply.ts on every event.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS xp_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  skill            text NOT NULL,
  delta            int  NOT NULL,
  reason           text NOT NULL,
  source_kind      text NOT NULL CHECK (source_kind IN ('sim','chat','module','manual')),
  source_id        text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  idempotency_key  text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS xp_ledger_user_created_idx
  ON xp_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS badges (
  id               text PRIMARY KEY,
  name_key         text NOT NULL,
  description_key  text NOT NULL,
  icon             text NULL,
  criteria         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    uuid NOT NULL,
  badge_id   text NOT NULL REFERENCES badges(id),
  earned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS quests (
  id               text PRIMARY KEY,
  name_key         text NOT NULL,
  description_key  text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('daily','weekly','onboarding')),
  goal             jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_xp        int  NOT NULL DEFAULT 0
);

-- user_quests is keyed by created_at as well so daily/weekly quest instances
-- can recur over time without colliding with prior completions. apply.ts looks
-- up the latest open row per (user, quest) when bumping progress.
CREATE TABLE IF NOT EXISTS user_quests (
  user_id       uuid NOT NULL,
  quest_id      text NOT NULL REFERENCES quests(id),
  progress      jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at  timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id, created_at)
);

CREATE INDEX IF NOT EXISTS user_quests_user_quest_idx
  ON user_quests (user_id, quest_id, created_at DESC);

CREATE TABLE IF NOT EXISTS streaks (
  user_id           uuid PRIMARY KEY,
  current_days      int  NOT NULL DEFAULT 0,
  longest_days      int  NOT NULL DEFAULT 0,
  last_active_date  date NULL
);
