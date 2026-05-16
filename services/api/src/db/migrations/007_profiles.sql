-- 007_profiles.sql
-- The user identity table. On Supabase, every row's id matches a row in
-- auth.users (1:1). On local Docker Postgres (no auth schema), the table is
-- still useful — the dev cookie issues UUIDs that match these rows.
--
-- The trigger that auto-creates a profile from auth.users is created
-- separately (services/api/src/db/migrations/007a_profiles_supabase.sql) so
-- this migration applies cleanly on either backend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        text,
  role             text NOT NULL CHECK (role IN ('hr', 'employee', 'intern', 'admin')) DEFAULT 'employee',
  is_mentor        boolean NOT NULL DEFAULT false,
  department       text,
  position         text,
  languages        text[] NOT NULL DEFAULT '{}',
  avatar_url       text,
  email            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  synthetic        boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_mentor_idx ON profiles (is_mentor) WHERE is_mentor = true;
CREATE INDEX IF NOT EXISTS profiles_synthetic_idx ON profiles (synthetic);

-- Keep updated_at fresh on row mutation.
CREATE OR REPLACE FUNCTION profiles_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_set_updated_at();
