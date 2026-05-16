-- 005_skills.sql
-- Skills Analysis Platform (Track 3): taxonomy, role requirements, training
-- catalog, and a 1h forecast cache. Idempotent: safe to re-apply.
--
-- Design notes:
--   * skill_nodes is the canonical taxonomy. Ids are lowercase snake_case
--     ('kyc', 'customer_service'). Anything aggregating xp_ledger.skill
--     normalises to this id space (see services/api/src/skills/service.ts).
--   * role_skill_requirements is keyed by a free-form target role string
--     ('senior_compliance', 'senior_operations'); add new targets by seed.
--   * training_modules is a thin catalog; the recommender ranks rows here.
--   * skill_forecasts_cache uses computed_at for a wall-clock TTL — the
--     reader treats rows older than 1h as a cache miss (no scheduled cleanup
--     needed for the Ideathon).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS skill_nodes (
  id                 text PRIMARY KEY,
  name_key           text NOT NULL,
  category           text NOT NULL,
  related_skill_ids  text[] NOT NULL DEFAULT '{}',
  target_xp          int  NOT NULL DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_skill_requirements (
  role      text NOT NULL,
  skill_id  text NOT NULL REFERENCES skill_nodes(id) ON DELETE CASCADE,
  min_xp    int NOT NULL DEFAULT 50,
  weight    numeric NOT NULL DEFAULT 1.0,
  PRIMARY KEY (role, skill_id)
);

CREATE INDEX IF NOT EXISTS role_skill_requirements_skill_idx
  ON role_skill_requirements (skill_id);

CREATE TABLE IF NOT EXISTS training_modules (
  id                 text PRIMARY KEY,
  title_key          text NULL,
  skill_id           text NULL REFERENCES skill_nodes(id),
  estimated_minutes  int  NOT NULL DEFAULT 20,
  content_uri        text NULL
);

CREATE INDEX IF NOT EXISTS training_modules_skill_idx
  ON training_modules (skill_id);

CREATE TABLE IF NOT EXISTS skill_forecasts_cache (
  employee_id   uuid NOT NULL,
  skill_id      text NOT NULL,
  horizon_days  int  NOT NULL,
  payload       jsonb NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, skill_id, horizon_days)
);
