CREATE TABLE IF NOT EXISTS activity_mmp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  duration_s integer NOT NULL,
  watts numeric NOT NULL,
  np numeric,
  vi numeric,
  source text NOT NULL DEFAULT 'stream',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, duration_s)
);

CREATE TABLE IF NOT EXISTS activity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id text NOT NULL,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  avg_power_watts numeric,
  np_watts numeric,
  vi numeric,
  avg_hr numeric,
  ef numeric,
  decoupling_pct numeric,
  stream_fingerprint text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_mmp_athlete_date ON activity_mmp (athlete_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_mmp_duration ON activity_mmp (athlete_id, duration_s);
CREATE INDEX IF NOT EXISTS idx_activity_metrics_athlete_date ON activity_metrics (athlete_id, date);

ALTER TABLE activity_mmp ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_activity_mmp') THEN
    CREATE POLICY "select_own_activity_mmp" ON activity_mmp FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_activity_mmp') THEN
    CREATE POLICY "insert_own_activity_mmp" ON activity_mmp FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_activity_mmp') THEN
    CREATE POLICY "update_own_activity_mmp" ON activity_mmp FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_activity_mmp') THEN
    CREATE POLICY "delete_own_activity_mmp" ON activity_mmp FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_activity_metrics') THEN
    CREATE POLICY "select_own_activity_metrics" ON activity_metrics FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_activity_metrics') THEN
    CREATE POLICY "insert_own_activity_metrics" ON activity_metrics FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_activity_metrics') THEN
    CREATE POLICY "update_own_activity_metrics" ON activity_metrics FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_activity_metrics') THEN
    CREATE POLICY "delete_own_activity_metrics" ON activity_metrics FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read activity_mmp') THEN
    CREATE POLICY "Anon read activity_mmp" ON activity_mmp FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon write activity_mmp') THEN
    CREATE POLICY "Anon write activity_mmp" ON activity_mmp FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anon update activity_mmp" ON activity_mmp FOR UPDATE TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "Anon delete activity_mmp" ON activity_mmp FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read activity_metrics') THEN
    CREATE POLICY "Anon read activity_metrics" ON activity_metrics FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon write activity_metrics') THEN
    CREATE POLICY "Anon write activity_metrics" ON activity_metrics FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anon update activity_metrics" ON activity_metrics FOR UPDATE TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "Anon delete activity_metrics" ON activity_metrics FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coach read activity_mmp') THEN
    CREATE POLICY "Coach read activity_mmp" ON activity_mmp FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coach read activity_metrics') THEN
    CREATE POLICY "Coach read activity_metrics" ON activity_metrics FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;