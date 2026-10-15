/*
# Race scenario simulations storage

1. New Tables
- `race_scenarios`: saved simulation inputs + results for the simulator
  (race, inverse goal, altitude, altitude block).
  - `id` uuid pk
  - `athlete_id` uuid not null, FK athletes(id) on delete cascade
  - `kind` text not null: 'race' | 'inverse' | 'altitude' | 'altitude_block'
  - `name` text not null: user label (e.g. "Maratón Buenos Aires")
  - `params` jsonb not null: engine scenario inputs
  - `result` jsonb null: key engine outputs for quick list preview
  - `created_at` timestamptz default now()

2. Security
- RLS enabled.
- Owner-scoped (athlete belongs to signed-in user) for authenticated:
  select/insert/update/delete.
- Anon policies mirror the existing dev-mode pattern on lab_tests etc.
  (this app supports a local dev mode with no session).
*/

CREATE TABLE IF NOT EXISTS race_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  params jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE race_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon manage race_scenarios" ON race_scenarios;
CREATE POLICY "Anon manage race_scenarios" ON race_scenarios
FOR ALL TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_race_scenarios" ON race_scenarios;
CREATE POLICY "select_own_race_scenarios" ON race_scenarios
FOR SELECT TO authenticated
USING (
  athlete_id IN (SELECT a.id FROM athletes a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_race_scenarios" ON race_scenarios;
CREATE POLICY "insert_own_race_scenarios" ON race_scenarios
FOR INSERT TO authenticated
WITH CHECK (
  athlete_id IN (SELECT a.id FROM athletes a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_race_scenarios" ON race_scenarios;
CREATE POLICY "update_own_race_scenarios" ON race_scenarios
FOR UPDATE TO authenticated
USING (
  athlete_id IN (SELECT a.id FROM athletes a WHERE a.user_id = auth.uid())
)
WITH CHECK (
  athlete_id IN (SELECT a.id FROM athletes a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_race_scenarios" ON race_scenarios;
CREATE POLICY "delete_own_race_scenarios" ON race_scenarios
FOR DELETE TO authenticated
USING (
  athlete_id IN (SELECT a.id FROM athletes a WHERE a.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_race_scenarios_athlete
  ON race_scenarios (athlete_id, created_at DESC);
