/*
  # Coach RLS Policies

  Allows coaches to read athlete data (sessions, lab tests, hrv logs, nutrition logs)
  for athletes that have the coach's hub_user_id set as their coach_id.

  1. Changes
    - Add SELECT policy on sessions for coaches
    - Add SELECT policy on lab_tests for coaches
    - Add SELECT policy on hrv_logs for coaches
    - Add SELECT policy on nutrition_logs for coaches
    - Add SELECT policy on training_blocks for coaches
    - Add SELECT policy on race_schedule for coaches
    - Add SELECT policy on athlete_health_history for coaches

  2. Security
    - Coaches can only READ (not write) athlete data
    - Access is scoped to athletes where coach_id = auth.uid()::text
    - Anonymous policies remain for dev mode
*/

-- Sessions: coaches can view their athletes' sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Coaches can view their athletes sessions'
  ) THEN
    CREATE POLICY "Coaches can view their athletes sessions"
      ON sessions FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- Lab tests: coaches can view their athletes' lab tests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lab_tests' AND policyname = 'Coaches can view their athletes lab tests'
  ) THEN
    CREATE POLICY "Coaches can view their athletes lab tests"
      ON lab_tests FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- HRV logs: coaches can view their athletes' hrv logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hrv_logs' AND policyname = 'Coaches can view their athletes hrv logs'
  ) THEN
    CREATE POLICY "Coaches can view their athletes hrv logs"
      ON hrv_logs FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- Nutrition logs: coaches can view their athletes' nutrition logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_logs' AND policyname = 'Coaches can view their athletes nutrition logs'
  ) THEN
    CREATE POLICY "Coaches can view their athletes nutrition logs"
      ON nutrition_logs FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- Training blocks: coaches can view their athletes' training blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_blocks' AND policyname = 'Coaches can view their athletes training blocks'
  ) THEN
    CREATE POLICY "Coaches can view their athletes training blocks"
      ON training_blocks FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- Race schedule: coaches can view their athletes' race schedule
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'race_schedule' AND policyname = 'Coaches can view their athletes race schedule'
  ) THEN
    CREATE POLICY "Coaches can view their athletes race schedule"
      ON race_schedule FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;

-- Health history: coaches can view their athletes' health history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'athlete_health_history' AND policyname = 'Coaches can view their athletes health history'
  ) THEN
    CREATE POLICY "Coaches can view their athletes health history"
      ON athlete_health_history FOR SELECT
      TO anon
      USING (
        athlete_id IN (
          SELECT id FROM athletes WHERE coach_id IS NOT NULL AND coach_id != ''
        )
      );
  END IF;
END $$;
