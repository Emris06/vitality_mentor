-- 002_simulator.sql
-- Persists Bank Operations Simulator scenario runs.
-- Idempotent: safe to re-apply.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS scenario_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  scenario_id     text NOT NULL,
  locale          text NOT NULL CHECK (locale IN ('uz', 'ru', 'en')),
  status          text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'scored', 'aborted')),
  current_step_id text NULL,
  state           jsonb NOT NULL DEFAULT '{}'::jsonb,
  mistakes        jsonb NOT NULL DEFAULT '[]'::jsonb,
  score           int NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz NULL
);

CREATE INDEX IF NOT EXISTS scenario_runs_user_started_idx
  ON scenario_runs (user_id, started_at DESC);
