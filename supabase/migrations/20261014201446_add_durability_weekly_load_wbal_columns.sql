/*
# Add durability, weekly load and W'bal storage

1. Plain-English summary
- Durability: for each activity with a power stream, we store the best (mean-max)
  power over 300 s and 1200 s windows taken AFTER 0 / 1000 / 2000 kJ of
  accumulated work, so the app can chart "power after fatigue".
- Weekly load: per athlete and Monday-start week we store total impulse plus
  Foster monotony and strain, computed from the 7 daily impulse values
  (rest days = 0).
- W'bal per ride: three summary numbers stored on activity_metrics
  (minimum W' balance in kJ, as % of W', and seconds spent below 25% of W').

2. New Tables
- `activity_durability`
  - `id` (uuid, primary key)
  - `activity_id` (text, not null) — the session id
  - `athlete_id` (uuid, not null, FK -> athletes ON DELETE CASCADE)
  - `date` (date, not null) — activity date
  - `kj_threshold` (integer, not null) — 0 / 1000 / 2000
  - `duration_s` (integer, not null) — 300 or 1200
  - `watts` (numeric, not null) — mean-max power over the window
  - UNIQUE (activity_id, kj_threshold, duration_s)
- `weekly_load`
  - `id` (uuid, primary key)
  - `athlete_id` (uuid, not null, FK -> athletes ON DELETE CASCADE)
  - `week_start` (date, not null) — Monday of the week
  - `total_impulse` (numeric, not null default 0)
  - `monotony` (numeric, nullable — null when sd = 0)
  - `strain` (numeric, nullable — null when monotony is null)
  - UNIQUE (athlete_id, week_start)

3. Modified Tables
- `activity_metrics`: add `min_wbal_kj` numeric, `min_wbal_pct` numeric,
  `seconds_below_25pct` integer (all nullable).

4. Security
- Enable RLS on both new tables.
- Owner-scoped authenticated policies (via athletes.user_id) + anon CRUD
  policies matching the existing dev-mode pattern used by activity_mmp /
  activity_metrics.

5. Notes
- Idempotent: CREATE TABLE IF NOT EXISTS, conditional column add, policies
  dropped-if-exists then recreated.
*/

CREATE TABLE IF NOT EXISTS activity_durability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  kj_threshold integer NOT NULL,
  duration_s integer NOT NULL,
  watts numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, kj_threshold, duration_s)
);

CREATE TABLE IF NOT EXISTS weekly_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  total_impulse numeric NOT NULL DEFAULT 0,
  monotony numeric,
  strain numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_activity_durability_athlete_date ON activity_durability (athlete_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_load_athlete_week ON weekly_load (athlete_id, week_start);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_metrics' AND column_name = 'min_wbal_kj'
  ) THEN
    ALTER TABLE activity_metrics
      ADD COLUMN min_wbal_kj numeric,
      ADD COLUMN min_wbal_pct numeric,
      ADD COLUMN seconds_below_25pct integer;
  END IF;
END $$;

ALTER TABLE activity_durability ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_load ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_activity_durability') THEN
    CREATE POLICY "select_own_activity_durability" ON activity_durability FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_activity_durability') THEN
    CREATE POLICY "insert_own_activity_durability" ON activity_durability FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_activity_durability') THEN
    CREATE POLICY "update_own_activity_durability" ON activity_durability FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_activity_durability') THEN
    CREATE POLICY "delete_own_activity_durability" ON activity_durability FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_weekly_load') THEN
    CREATE POLICY "select_own_weekly_load" ON weekly_load FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_weekly_load') THEN
    CREATE POLICY "insert_own_weekly_load" ON weekly_load FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_weekly_load') THEN
    CREATE POLICY "update_own_weekly_load" ON weekly_load FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_weekly_load') THEN
    CREATE POLICY "delete_own_weekly_load" ON weekly_load FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;

  -- Dev-mode anon policies (mirror activity_mmp / activity_metrics)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read activity_durability') THEN
    CREATE POLICY "Anon read activity_durability" ON activity_durability FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon write activity_durability') THEN
    CREATE POLICY "Anon write activity_durability" ON activity_durability FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon update activity_durability') THEN
    CREATE POLICY "Anon update activity_durability" ON activity_durability FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon delete activity_durability') THEN
    CREATE POLICY "Anon delete activity_durability" ON activity_durability FOR DELETE TO anon USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read weekly_load') THEN
    CREATE POLICY "Anon read weekly_load" ON weekly_load FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon write weekly_load') THEN
    CREATE POLICY "Anon write weekly_load" ON weekly_load FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon update weekly_load') THEN
    CREATE POLICY "Anon update weekly_load" ON weekly_load FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon delete weekly_load') THEN
    CREATE POLICY "Anon delete weekly_load" ON weekly_load FOR DELETE TO anon USING (true);
  END IF;
END $$;
