CREATE TABLE IF NOT EXISTS daily_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  sport text NOT NULL,
  impulse numeric NOT NULL DEFAULT 0,
  intensity_source text NOT NULL DEFAULT 'default',
  quality text NOT NULL DEFAULT 'estimated',
  formula_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date, sport)
);

CREATE TABLE IF NOT EXISTS daily_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  fitness numeric NOT NULL DEFAULT 0,
  fatigue numeric NOT NULL DEFAULT 0,
  form numeric NOT NULL DEFAULT 0,
  formula_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_load_athlete_date ON daily_load (athlete_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_state_athlete_date ON daily_state (athlete_id, date);

ALTER TABLE daily_load ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_daily_load') THEN
    CREATE POLICY "select_own_daily_load" ON daily_load FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_daily_load') THEN
    CREATE POLICY "insert_own_daily_load" ON daily_load FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_daily_load') THEN
    CREATE POLICY "update_own_daily_load" ON daily_load FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_daily_load') THEN
    CREATE POLICY "delete_own_daily_load" ON daily_load FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'select_own_daily_state') THEN
    CREATE POLICY "select_own_daily_state" ON daily_state FOR SELECT
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'insert_own_daily_state') THEN
    CREATE POLICY "insert_own_daily_state" ON daily_state FOR INSERT
      TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'update_own_daily_state') THEN
    CREATE POLICY "update_own_daily_state" ON daily_state FOR UPDATE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delete_own_daily_state') THEN
    CREATE POLICY "delete_own_daily_state" ON daily_state FOR DELETE
      TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read daily_load') THEN
    CREATE POLICY "Anon read daily_load" ON daily_load FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon insert daily_load') THEN
    CREATE POLICY "Anon insert daily_load" ON daily_load FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon update daily_load') THEN
    CREATE POLICY "Anon update daily_load" ON daily_load FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon delete daily_load') THEN
    CREATE POLICY "Anon delete daily_load" ON daily_load FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon read daily_state') THEN
    CREATE POLICY "Anon read daily_state" ON daily_state FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon insert daily_state') THEN
    CREATE POLICY "Anon insert daily_state" ON daily_state FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon update daily_state') THEN
    CREATE POLICY "Anon update daily_state" ON daily_state FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon delete daily_state') THEN
    CREATE POLICY "Anon delete daily_state" ON daily_state FOR DELETE TO anon USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coach read daily_load') THEN
    CREATE POLICY "Coach read daily_load" ON daily_load FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Coach read daily_state') THEN
    CREATE POLICY "Coach read daily_state" ON daily_state FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;
