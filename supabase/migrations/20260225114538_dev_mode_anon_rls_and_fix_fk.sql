/*
  # Local Development Mode: Fix FK constraints and add anon RLS policies

  1. FK Changes
    - Drop athletes.user_id FK from auth.users
    - Drop shareable_links.user_id FK from auth.users
    - (These tables use hub_user_id / profiles.id in dev mode, no Supabase Auth)

  2. RLS Policies - Allow anonymous access to all tables for local dev
    - profiles: read, insert, update (already created, skip if exist)
    - athletes: read, insert, update, delete
    - sessions: read, insert, update, delete
    - lab_tests: read, insert, update, delete
    - nutrition_logs: read, insert, update, delete
    - performance_snapshots: read, insert, update, delete
    - hrv_logs: read, insert, update, delete
    - body_composition: read, insert, update, delete
    - shareable_links: read, insert, update, delete

  3. Notes
    - This allows the satellite to work in local dev mode without Supabase Auth
    - Authentication is handled by hub.asciende.pro in production
    - VITE_FORCE_DEV_MODE=true enables this mode locally
*/

-- ==============================
-- Fix FK constraints (drop auth.users references)
-- ==============================

ALTER TABLE athletes
  DROP CONSTRAINT IF EXISTS athletes_user_id_fkey;

ALTER TABLE shareable_links
  DROP CONSTRAINT IF EXISTS shareable_links_user_id_fkey;

-- ==============================
-- Profiles - anon policies (profiles table already has some, add if missing)
-- ==============================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Anonymous can read profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Anonymous can read profiles" ON profiles FOR SELECT TO anon USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Anonymous can create profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Anonymous can create profiles" ON profiles FOR INSERT TO anon WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Anonymous can update profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Anonymous can update profiles" ON profiles FOR UPDATE TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ==============================
-- Athletes
-- ==============================

CREATE POLICY "Anonymous can read athletes"
  ON athletes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert athletes"
  ON athletes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update athletes"
  ON athletes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete athletes"
  ON athletes FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Sessions
-- ==============================

CREATE POLICY "Anonymous can read sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete sessions"
  ON sessions FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Lab Tests
-- ==============================

CREATE POLICY "Anonymous can read lab_tests"
  ON lab_tests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert lab_tests"
  ON lab_tests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update lab_tests"
  ON lab_tests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete lab_tests"
  ON lab_tests FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Nutrition Logs
-- ==============================

CREATE POLICY "Anonymous can read nutrition_logs"
  ON nutrition_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert nutrition_logs"
  ON nutrition_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update nutrition_logs"
  ON nutrition_logs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete nutrition_logs"
  ON nutrition_logs FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Performance Snapshots
-- ==============================

CREATE POLICY "Anonymous can read performance_snapshots"
  ON performance_snapshots FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert performance_snapshots"
  ON performance_snapshots FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update performance_snapshots"
  ON performance_snapshots FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete performance_snapshots"
  ON performance_snapshots FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- HRV Logs
-- ==============================

CREATE POLICY "Anonymous can read hrv_logs"
  ON hrv_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert hrv_logs"
  ON hrv_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update hrv_logs"
  ON hrv_logs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete hrv_logs"
  ON hrv_logs FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Body Composition
-- ==============================

CREATE POLICY "Anonymous can read body_composition"
  ON body_composition FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert body_composition"
  ON body_composition FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update body_composition"
  ON body_composition FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete body_composition"
  ON body_composition FOR DELETE
  TO anon
  USING (true);

-- ==============================
-- Shareable Links
-- ==============================

CREATE POLICY "Anonymous can read shareable_links"
  ON shareable_links FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous can insert shareable_links"
  ON shareable_links FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous can update shareable_links"
  ON shareable_links FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can delete shareable_links"
  ON shareable_links FOR DELETE
  TO anon
  USING (true);
