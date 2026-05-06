
/*
  # ASC Impulse Engine – Core Schema

  ## Overview
  Creates the full physiological data model for the ASC Impulse Engine, a Bannister
  impulse-response performance prediction system.

  ## New Tables

  ### athletes
  - Stores physiological profile: VO2max, vLamax, lean mass, critical power, sport weights
  - Used to personalize tau constants and k multiplier

  ### sessions
  - Endurance and strength training sessions with all raw inputs
  - Impulse is calculated client-side and stored for historical queries
  - Supports endurance (power/HR based) and strength (load/reps/velocity/RIR) types

  ### lab_tests
  - Physiological lab testing results (VO2max, vLamax, CP, lactate thresholds)
  - Used to update athlete profile and recalibrate model parameters

  ### nutrition_logs
  - Daily nutrition records affecting recovery and adaptation
  - Used as a modifier on fatigue decay constants

  ### performance_snapshots
  - Daily computed values: fitness, fatigue, form, recovery ratio
  - Stored for chart rendering and trend analysis

  ## Security
  - RLS enabled on all tables
  - Authenticated users can only access their own athlete record and related data
*/

CREATE TABLE IF NOT EXISTS athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sport text NOT NULL DEFAULT 'cycling',
  vo2max numeric(5,2) DEFAULT 50,
  vlamax numeric(5,3) DEFAULT 0.4,
  lean_mass_kg numeric(5,2) DEFAULT 70,
  weight_kg numeric(5,2) DEFAULT 75,
  cp_watts integer DEFAULT 250,
  ftp_watts integer DEFAULT 235,
  max_hr integer DEFAULT 185,
  resting_hr integer DEFAULT 50,
  sport_weights jsonb DEFAULT '{"endurance": 0.7, "strength": 0.2, "other": 0.1}'::jsonb,
  tau_fitness numeric(5,2) DEFAULT 42,
  tau_fatigue numeric(5,2) DEFAULT 7,
  k_multiplier numeric(5,3) DEFAULT 2.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  session_date date NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('endurance', 'strength', 'other')),
  title text DEFAULT '',
  notes text DEFAULT '',
  duration_min numeric(6,2) DEFAULT 0,
  avg_power_watts integer,
  normalized_power_watts integer,
  avg_hr integer,
  max_hr integer,
  rpe integer CHECK (rpe >= 1 AND rpe <= 10),
  distance_km numeric(8,3),
  elevation_m integer,
  strength_exercises jsonb,
  impulse numeric(10,4) DEFAULT 0,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  test_date date NOT NULL,
  test_type text NOT NULL DEFAULT 'ramp',
  vo2max numeric(5,2),
  vlamax numeric(5,3),
  cp_watts integer,
  ftp_watts integer,
  lactate_threshold_1_watts integer,
  lactate_threshold_2_watts integer,
  lactate_threshold_1_hr integer,
  lactate_threshold_2_hr integer,
  fat_max_watts integer,
  notes text DEFAULT '',
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  log_date date NOT NULL,
  calories integer DEFAULT 0,
  protein_g numeric(6,2) DEFAULT 0,
  carbs_g numeric(6,2) DEFAULT 0,
  fat_g numeric(6,2) DEFAULT 0,
  hydration_ml integer DEFAULT 0,
  sleep_hours numeric(4,2) DEFAULT 8,
  sleep_quality integer CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id, log_date)
);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  fitness numeric(10,4) DEFAULT 0,
  fatigue numeric(10,4) DEFAULT 0,
  form numeric(10,4) DEFAULT 0,
  recovery_ratio numeric(6,4) DEFAULT 0,
  tau_fitness_used numeric(5,2),
  tau_fatigue_used numeric(5,2),
  k_used numeric(5,3),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sessions_athlete_date ON sessions(athlete_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_lab_tests_athlete_date ON lab_tests(athlete_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_athlete_date ON nutrition_logs(athlete_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_athlete_date ON performance_snapshots(athlete_id, snapshot_date DESC);

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes: owner select"
  ON athletes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Athletes: owner insert"
  ON athletes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Athletes: owner update"
  ON athletes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Athletes: owner delete"
  ON athletes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Sessions: owner select"
  ON sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = sessions.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Sessions: owner insert"
  ON sessions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = sessions.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Sessions: owner update"
  ON sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = sessions.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = sessions.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Sessions: owner delete"
  ON sessions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = sessions.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "LabTests: owner select"
  ON lab_tests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = lab_tests.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "LabTests: owner insert"
  ON lab_tests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = lab_tests.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "LabTests: owner update"
  ON lab_tests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = lab_tests.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = lab_tests.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "LabTests: owner delete"
  ON lab_tests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = lab_tests.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Nutrition: owner select"
  ON nutrition_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = nutrition_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Nutrition: owner insert"
  ON nutrition_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = nutrition_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Nutrition: owner update"
  ON nutrition_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = nutrition_logs.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = nutrition_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Nutrition: owner delete"
  ON nutrition_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = nutrition_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Snapshots: owner select"
  ON performance_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = performance_snapshots.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Snapshots: owner insert"
  ON performance_snapshots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = performance_snapshots.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Snapshots: owner update"
  ON performance_snapshots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = performance_snapshots.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = performance_snapshots.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "Snapshots: owner delete"
  ON performance_snapshots FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = performance_snapshots.athlete_id AND athletes.user_id = auth.uid()));
