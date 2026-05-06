/*
  # Advanced Training Tables

  1. New Tables
    - `hrv_logs` - Daily HRV measurements (RMSSD, SDNN, morning HR)
    - `training_blocks` - Periodization blocks (base, build, peak, taper, recovery)
    - `race_schedule` - Upcoming races with target goals and taper planning
    - `athlete_health_history` - Injuries, illnesses, surgeries affecting training

  2. Schema Additions to Existing Tables
    - sessions: training_intention, temperature_c, humidity_pct, altitude_m, zone_distribution, perceived_difficulty, how_felt
    - athletes: training_experience_years, primary_goal, goal_timeline_weeks, onboarding_completed

  3. Security
    - RLS enabled on all new tables
    - Authenticated users can CRUD their own records
    - Anon access allowed for dev mode
*/

-- HRV Logs
CREATE TABLE IF NOT EXISTS hrv_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  rmssd numeric(6,2),
  sdnn numeric(6,2),
  hrv_score numeric(5,2),
  morning_hr integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hrv_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Athletes can read own hrv logs') THEN
    CREATE POLICY "Athletes can read own hrv logs" ON hrv_logs FOR SELECT TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Athletes can insert own hrv logs') THEN
    CREATE POLICY "Athletes can insert own hrv logs" ON hrv_logs FOR INSERT TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Athletes can update own hrv logs') THEN
    CREATE POLICY "Athletes can update own hrv logs" ON hrv_logs FOR UPDATE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Athletes can delete own hrv logs') THEN
    CREATE POLICY "Athletes can delete own hrv logs" ON hrv_logs FOR DELETE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Anon read hrv logs') THEN
    CREATE POLICY "Anon read hrv logs" ON hrv_logs FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Anon insert hrv logs') THEN
    CREATE POLICY "Anon insert hrv logs" ON hrv_logs FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Anon update hrv logs') THEN
    CREATE POLICY "Anon update hrv logs" ON hrv_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Anon delete hrv logs') THEN
    CREATE POLICY "Anon delete hrv logs" ON hrv_logs FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Training Blocks
CREATE TABLE IF NOT EXISTS training_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  block_type text NOT NULL DEFAULT 'build' CHECK (block_type IN ('base', 'build', 'peak', 'taper', 'recovery')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  target_focus text DEFAULT '',
  planned_impulse numeric(10,4),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Athletes can read own training blocks') THEN
    CREATE POLICY "Athletes can read own training blocks" ON training_blocks FOR SELECT TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Athletes can insert own training blocks') THEN
    CREATE POLICY "Athletes can insert own training blocks" ON training_blocks FOR INSERT TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Athletes can update own training blocks') THEN
    CREATE POLICY "Athletes can update own training blocks" ON training_blocks FOR UPDATE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Athletes can delete own training blocks') THEN
    CREATE POLICY "Athletes can delete own training blocks" ON training_blocks FOR DELETE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Anon full access training blocks') THEN
    CREATE POLICY "Anon full access training blocks" ON training_blocks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Race Schedule
CREATE TABLE IF NOT EXISTS race_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  race_name text NOT NULL DEFAULT '',
  race_date date NOT NULL,
  race_type text DEFAULT 'other' CHECK (race_type IN ('cycling', 'running', 'triathlon', 'swimming', 'beach_volleyball', 'other')),
  distance_km numeric(8,2),
  goal_duration_min integer,
  priority text DEFAULT 'b' CHECK (priority IN ('a', 'b', 'c')),
  taper_start_date date,
  taper_reduction_pct integer DEFAULT 40,
  notes text DEFAULT '',
  completed boolean DEFAULT false,
  actual_duration_min integer,
  result_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE race_schedule ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Athletes can read own race schedule') THEN
    CREATE POLICY "Athletes can read own race schedule" ON race_schedule FOR SELECT TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Athletes can insert own race schedule') THEN
    CREATE POLICY "Athletes can insert own race schedule" ON race_schedule FOR INSERT TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Athletes can update own race schedule') THEN
    CREATE POLICY "Athletes can update own race schedule" ON race_schedule FOR UPDATE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Athletes can delete own race schedule') THEN
    CREATE POLICY "Athletes can delete own race schedule" ON race_schedule FOR DELETE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Anon full access race schedule') THEN
    CREATE POLICY "Anon full access race schedule" ON race_schedule FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Athlete Health History
CREATE TABLE IF NOT EXISTS athlete_health_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'injury' CHECK (event_type IN ('injury', 'illness', 'surgery', 'medication_start', 'medication_end', 'other')),
  description text NOT NULL DEFAULT '',
  affected_systems text[] DEFAULT '{}',
  recovery_expected_days integer,
  is_current boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_health_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Athletes can read own health history') THEN
    CREATE POLICY "Athletes can read own health history" ON athlete_health_history FOR SELECT TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Athletes can insert own health history') THEN
    CREATE POLICY "Athletes can insert own health history" ON athlete_health_history FOR INSERT TO authenticated
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Athletes can update own health history') THEN
    CREATE POLICY "Athletes can update own health history" ON athlete_health_history FOR UPDATE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
      WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Athletes can delete own health history') THEN
    CREATE POLICY "Athletes can delete own health history" ON athlete_health_history FOR DELETE TO authenticated
      USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Anon full access health history') THEN
    CREATE POLICY "Anon full access health history" ON athlete_health_history FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Extend sessions table with new fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'training_intention') THEN
    ALTER TABLE sessions ADD COLUMN training_intention text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'temperature_c') THEN
    ALTER TABLE sessions ADD COLUMN temperature_c numeric(5,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'humidity_pct') THEN
    ALTER TABLE sessions ADD COLUMN humidity_pct integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'altitude_m_env') THEN
    ALTER TABLE sessions ADD COLUMN altitude_m_env integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'zone_distribution') THEN
    ALTER TABLE sessions ADD COLUMN zone_distribution jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'perceived_difficulty') THEN
    ALTER TABLE sessions ADD COLUMN perceived_difficulty integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'how_felt') THEN
    ALTER TABLE sessions ADD COLUMN how_felt text;
  END IF;
END $$;

-- Extend athletes table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athletes' AND column_name = 'training_experience_years') THEN
    ALTER TABLE athletes ADD COLUMN training_experience_years integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athletes' AND column_name = 'primary_goal') THEN
    ALTER TABLE athletes ADD COLUMN primary_goal text DEFAULT 'general_fitness';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athletes' AND column_name = 'goal_timeline_weeks') THEN
    ALTER TABLE athletes ADD COLUMN goal_timeline_weeks integer DEFAULT 16;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athletes' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE athletes ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hrv_logs_athlete_date ON hrv_logs(athlete_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_blocks_athlete ON training_blocks(athlete_id, start_date);
CREATE INDEX IF NOT EXISTS idx_race_schedule_athlete ON race_schedule(athlete_id, race_date);
CREATE INDEX IF NOT EXISTS idx_health_history_athlete ON athlete_health_history(athlete_id, event_date DESC);
