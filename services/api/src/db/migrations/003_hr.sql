-- 003_hr.sql
-- HR dashboard + mentor matching. All seed rows are tagged synthetic=true
-- so a future cleanup can wipe demo data without touching real records.
-- Idempotent: safe to re-apply.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  role          text NOT NULL CHECK (role IN ('hr','mentor','newcomer','employee','admin')),
  department    text NULL,
  position      text NULL,
  languages     text[] NOT NULL DEFAULT '{}',
  current_load  int NOT NULL DEFAULT 0,
  skills        text[] NOT NULL DEFAULT '{}',
  hired_at      date NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  synthetic     boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS employees_role_idx ON employees (role);

CREATE TABLE IF NOT EXISTS newcomers (
  employee_id          uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  start_date           date NOT NULL,
  onboarding_deadline  date NOT NULL,
  assigned_mentor_id   uuid NULL REFERENCES employees(id),
  modules_completed    int NOT NULL DEFAULT 0,
  modules_total        int NOT NULL DEFAULT 12
);

CREATE INDEX IF NOT EXISTS newcomers_assigned_mentor_idx
  ON newcomers (assigned_mentor_id);

CREATE TABLE IF NOT EXISTS mentor_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id      uuid NOT NULL REFERENCES employees(id),
  newcomer_id    uuid NOT NULL REFERENCES employees(id),
  status         text NOT NULL CHECK (status IN ('active','completed','paused')),
  match_score    numeric NOT NULL,
  match_reasons  jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  unassigned_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS mentor_assignments_newcomer_status_idx
  ON mentor_assignments (newcomer_id, status);
