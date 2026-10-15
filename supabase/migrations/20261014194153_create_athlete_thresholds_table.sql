/*
# Athlete threshold history table

1. Plain-English summary
When an athlete's threshold values (Critical Power, LT2 heart rate,
threshold running speed) change, the impulse engine must use the values
that were valid on each session's date — never rewrite history
retroactively. This migration adds a dated history table: each change
appends a row effective from a given date, and the engine picks the row
with the latest effective_from <= session date.

2. New tables
- `athlete_thresholds`:
  - `id` (uuid, primary key)
  - `athlete_id` (uuid, NOT NULL, FK -> athletes(id) ON DELETE CASCADE)
  - `effective_from` (date, NOT NULL): first date this row applies to
  - `cp_watts` (numeric, nullable): Critical Power
  - `hr_lt2_bpm` (integer, nullable): LT2 heart rate
  - `threshold_speed_kmh` (numeric, nullable): running speed at LT2/VT2
  - `source` (text, NOT NULL): one of 'profile' | 'passport' | 'model' | 'lab'
  - `created_at` (timestamptz, default now())
  - UNIQUE (athlete_id, effective_from)

3. Security
RLS enabled. Owner-scoped CRUD for authenticated users through the
athletes parent (same predicate as daily_load/daily_state policies); anon
CRUD allowed to match the existing dev-mode anon policies on the impulse
tables; anon SELECT for coach reads.

4. Notes
- UNIQUE (athlete_id, effective_from) makes seeding idempotent via upsert.
- Fallback chain when no row matches a session date: current profile
  values, quality 'estimated'.
*/

CREATE TABLE IF NOT EXISTS athlete_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  cp_watts numeric,
  hr_lt2_bpm integer,
  threshold_speed_kmh numeric,
  source text NOT NULL DEFAULT 'profile',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_athlete_thresholds_athlete_date
  ON athlete_thresholds (athlete_id, effective_from);

ALTER TABLE athlete_thresholds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_athlete_thresholds') THEN
    CREATE POLICY "select_own_athlete_thresholds" ON athlete_thresholds FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_athlete_thresholds') THEN
    CREATE POLICY "insert_own_athlete_thresholds" ON athlete_thresholds FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_athlete_thresholds') THEN
    CREATE POLICY "update_own_athlete_thresholds" ON athlete_thresholds FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_athlete_thresholds') THEN
    CREATE POLICY "delete_own_athlete_thresholds" ON athlete_thresholds FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read athlete_thresholds') THEN
    CREATE POLICY "Anon read athlete_thresholds" ON athlete_thresholds FOR SELECT
      TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon insert athlete_thresholds') THEN
    CREATE POLICY "Anon insert athlete_thresholds" ON athlete_thresholds FOR INSERT
      TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon update athlete_thresholds') THEN
    CREATE POLICY "Anon update athlete_thresholds" ON athlete_thresholds FOR UPDATE
      TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon delete athlete_thresholds') THEN
    CREATE POLICY "Anon delete athlete_thresholds" ON athlete_thresholds FOR DELETE
      TO anon USING (true);
  END IF;
END $$;
