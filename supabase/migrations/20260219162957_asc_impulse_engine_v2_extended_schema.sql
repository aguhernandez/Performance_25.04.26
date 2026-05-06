
/*
  # ASC Impulse Engine v2 – Extended Schema

  ## Overview
  Extends the existing schema with:
  1. HRV logs table for heart rate variability tracking
  2. Body composition measurements for periodic tracking
  3. Session type constraint update to support beach_volleyball, cycling, running
  4. Athlete table extended with HRV baseline, running/cycling-specific metrics

  ## New Tables

  ### hrv_logs
  - Daily HRV measurements (rMSSD, SDNN, morning HRV score)
  - Used to dynamically adjust fatigue decay constants and recovery ratio

  ### body_composition
  - Periodic body composition measurements (weight, fat%, lean mass, water%)
  - Feeds into individualizedTau() to keep model parameters current

  ## Modified Tables

  ### athletes
  - Added hrv_baseline: resting HRV reference value
  - Added running_vdot: VDOT score for running performance reference
  - Added run_threshold_pace: pace at lactate threshold (min/km)
  - Added jump_height_cm: countermovement jump height (beach volley / strength)
  - Added body_fat_pct: current body fat percentage

  ### sessions
  - CHECK constraint extended to allow: endurance, strength, other, beach_volleyball, running, cycling

  ## Security
  - RLS enabled on all new tables
  - Policies consistent with existing pattern (owner-only access)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'hrv_baseline'
  ) THEN
    ALTER TABLE athletes
      ADD COLUMN hrv_baseline numeric(6,2) DEFAULT 55,
      ADD COLUMN running_vdot numeric(5,2) DEFAULT 45,
      ADD COLUMN run_threshold_pace numeric(6,3) DEFAULT 4.5,
      ADD COLUMN jump_height_cm numeric(5,2) DEFAULT 35,
      ADD COLUMN body_fat_pct numeric(5,2) DEFAULT 15;
  END IF;
END $$;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_session_type_check
  CHECK (session_type IN ('endurance', 'strength', 'other', 'beach_volleyball', 'running', 'cycling'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'sub_sport'
  ) THEN
    ALTER TABLE sessions
      ADD COLUMN sub_sport text DEFAULT NULL,
      ADD COLUMN sport_specific_data jsonb DEFAULT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hrv_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  log_date date NOT NULL,
  rmssd numeric(7,2),
  sdnn numeric(7,2),
  hrv_score numeric(5,2),
  morning_hr integer,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id, log_date)
);

CREATE TABLE IF NOT EXISTS body_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE CASCADE NOT NULL,
  measured_date date NOT NULL,
  weight_kg numeric(5,2) NOT NULL,
  fat_pct numeric(5,2),
  lean_mass_kg numeric(5,2),
  water_pct numeric(5,2),
  bone_mass_kg numeric(4,2),
  visceral_fat_rating integer,
  muscle_mass_kg numeric(5,2),
  method text DEFAULT 'bioimpedance',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hrv_athlete_date ON hrv_logs(athlete_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_comp_athlete_date ON body_composition(athlete_id, measured_date DESC);

ALTER TABLE hrv_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HRV: owner select"
  ON hrv_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = hrv_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "HRV: owner insert"
  ON hrv_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = hrv_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "HRV: owner update"
  ON hrv_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = hrv_logs.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = hrv_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "HRV: owner delete"
  ON hrv_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = hrv_logs.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "BodyComp: owner select"
  ON body_composition FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = body_composition.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "BodyComp: owner insert"
  ON body_composition FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = body_composition.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "BodyComp: owner update"
  ON body_composition FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = body_composition.athlete_id AND athletes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = body_composition.athlete_id AND athletes.user_id = auth.uid()));

CREATE POLICY "BodyComp: owner delete"
  ON body_composition FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM athletes WHERE athletes.id = body_composition.athlete_id AND athletes.user_id = auth.uid()));
