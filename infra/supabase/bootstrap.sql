-- infra/supabase/bootstrap.sql
-- Apply this in the Supabase SQL editor AFTER you've run the standard
-- migrations under services/api/src/db/migrations/. It wires Supabase's
-- managed auth.users table to our profiles table and enables Row-Level
-- Security with role-aware policies.
--
-- Idempotent. Safe to re-run.

-------------------------------------------------------------------------------
-- 1. Link profiles.id to auth.users via a foreign key.
-------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-------------------------------------------------------------------------------
-- 2. Trigger: on auth.users insert, create a matching profile row carrying
--    the role + full_name from raw_user_meta_data.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_full_name   text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
  IF v_role NOT IN ('hr','employee','intern','admin') THEN
    v_role := 'employee';
  END IF;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (NEW.id, v_full_name, v_role, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-------------------------------------------------------------------------------
-- 3. Row-Level Security.
--    Every table we expose to the anon/authenticated client must enable RLS.
-------------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: is the current caller an HR user?
CREATE OR REPLACE FUNCTION public.is_hr() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr','admin')
  );
$$;

-- Read: any authenticated user can read profiles (HR needs everyone visible).
DROP POLICY IF EXISTS profiles_read_all ON profiles;
CREATE POLICY profiles_read_all ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Update: only the row owner OR an HR/admin.
DROP POLICY IF EXISTS profiles_update_own_or_hr ON profiles;
CREATE POLICY profiles_update_own_or_hr ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_hr())
  WITH CHECK (id = auth.uid() OR public.is_hr());

-- Insert: only HR can manually insert (regular users get a profile from the
-- handle_new_user trigger).
DROP POLICY IF EXISTS profiles_insert_hr ON profiles;
CREATE POLICY profiles_insert_hr ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_hr());

-------------------------------------------------------------------------------
-- 4. Extend RLS to the operational tables defined by earlier migrations.
--    Each block guards against missing tables so this file stays idempotent
--    even if a migration was skipped.
-------------------------------------------------------------------------------

-- chat_sessions / chat_messages: owner-only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    EXECUTE 'ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS chat_sessions_owner ON chat_sessions';
    EXECUTE 'CREATE POLICY chat_sessions_owner ON chat_sessions FOR ALL TO authenticated USING (user_id::text = auth.uid()::text) WITH CHECK (user_id::text = auth.uid()::text)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    EXECUTE 'ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS chat_messages_via_session ON chat_messages';
    EXECUTE 'CREATE POLICY chat_messages_via_session ON chat_messages FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id::text = auth.uid()::text)) WITH CHECK (EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id::text = auth.uid()::text))';
  END IF;
END $$;

-- scenario_runs: owner or HR.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenario_runs') THEN
    EXECUTE 'ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS scenario_runs_owner_or_hr ON scenario_runs';
    EXECUTE 'CREATE POLICY scenario_runs_owner_or_hr ON scenario_runs FOR SELECT TO authenticated USING (user_id::text = auth.uid()::text OR public.is_hr())';
    EXECUTE 'DROP POLICY IF EXISTS scenario_runs_owner_write ON scenario_runs';
    EXECUTE 'CREATE POLICY scenario_runs_owner_write ON scenario_runs FOR INSERT TO authenticated WITH CHECK (user_id::text = auth.uid()::text)';
    EXECUTE 'DROP POLICY IF EXISTS scenario_runs_owner_update ON scenario_runs';
    EXECUTE 'CREATE POLICY scenario_runs_owner_update ON scenario_runs FOR UPDATE TO authenticated USING (user_id::text = auth.uid()::text) WITH CHECK (user_id::text = auth.uid()::text)';
  END IF;
END $$;

-- mentor_assignments / employees / newcomers: HR full access, others read only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mentor_assignments') THEN
    EXECUTE 'ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS mentor_assignments_read ON mentor_assignments';
    EXECUTE 'CREATE POLICY mentor_assignments_read ON mentor_assignments FOR SELECT TO authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS mentor_assignments_hr_write ON mentor_assignments';
    EXECUTE 'CREATE POLICY mentor_assignments_hr_write ON mentor_assignments FOR ALL TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr())';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    EXECUTE 'ALTER TABLE employees ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS employees_read ON employees';
    EXECUTE 'CREATE POLICY employees_read ON employees FOR SELECT TO authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS employees_hr_write ON employees';
    EXECUTE 'CREATE POLICY employees_hr_write ON employees FOR ALL TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr())';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'newcomers') THEN
    EXECUTE 'ALTER TABLE newcomers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS newcomers_read ON newcomers';
    EXECUTE 'CREATE POLICY newcomers_read ON newcomers FOR SELECT TO authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS newcomers_hr_write ON newcomers';
    EXECUTE 'CREATE POLICY newcomers_hr_write ON newcomers FOR ALL TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr())';
  END IF;
END $$;

-- xp_ledger / user_badges / user_quests: owner-only read.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'xp_ledger') THEN
    EXECUTE 'ALTER TABLE xp_ledger ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS xp_ledger_owner ON xp_ledger';
    EXECUTE 'CREATE POLICY xp_ledger_owner ON xp_ledger FOR SELECT TO authenticated USING (user_id::text = auth.uid()::text OR public.is_hr())';
  END IF;
END $$;
