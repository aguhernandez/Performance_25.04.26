/*
# Coach athlete-management write policies

1. Plain-English explanation
Coaches can now open an assigned athlete's performance view and edit
thresholds (CP, LT2 HR) and tau. Editing thresholds writes a new row to
`athlete_thresholds`, and the recompute engine upserts rows into
`daily_load`, `daily_state` and `weekly_load` for that athlete. Until now
those tables only had coach READ policies, so a coach edit would fail.
This migration adds the missing coach WRITE policies. Head coaches keep
read-only access; only the assigned coach can write.

2. Modified tables (no schema changes, policies only)
- `athletes`: assigned coach may UPDATE (scope: athletes.coach_id = caller,
  or a coach_athletes row links them).
- `athlete_thresholds`: assigned coach may INSERT / UPDATE history rows.
- `daily_load`, `daily_state`, `weekly_load`: assigned coach may INSERT /
  UPDATE recompute output rows for assigned athletes.

3. Security
- RLS is already enabled on every table; no `USING (true)` anywhere.
- Existing policies are untouched; only new, narrowly-scoped policies are added.
- "Assigned" means: athletes.coach_id = auth.uid()::text OR an EXISTS row in
  coach_athletes(coach_id = auth.uid(), athlete_id = the row's athlete).
- Head coaches (is_head_coach_or_admin()) are intentionally NOT granted
  write — they read everything but do not edit athletes.
*/

-- ---------------------------------------------------------------------------
-- athletes: assigned coach can update training fields
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches manage assigned athletes" ON athletes;
CREATE POLICY "Coaches manage assigned athletes" ON athletes
FOR UPDATE TO authenticated
USING (
  coach_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = athletes.id
  )
)
WITH CHECK (
  coach_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM coach_athletes ca
    WHERE ca.coach_id = auth.uid() AND ca.athlete_id = athletes.id
  )
);

-- ---------------------------------------------------------------------------
-- athlete_thresholds: assigned coach writes history rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches insert thresholds for assigned" ON athlete_thresholds;
CREATE POLICY "Coaches insert thresholds for assigned" ON athlete_thresholds
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = athlete_thresholds.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches update thresholds for assigned" ON athlete_thresholds;
CREATE POLICY "Coaches update thresholds for assigned" ON athlete_thresholds
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = athlete_thresholds.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = athlete_thresholds.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- daily_load / daily_state / weekly_load: assigned coach writes recompute rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches write daily_load for assigned" ON daily_load;
CREATE POLICY "Coaches write daily_load for assigned" ON daily_load
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches update daily_load for assigned" ON daily_load;
CREATE POLICY "Coaches update daily_load for assigned" ON daily_load
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches write daily_state for assigned" ON daily_state;
CREATE POLICY "Coaches write daily_state for assigned" ON daily_state
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_state.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches update daily_state for assigned" ON daily_state;
CREATE POLICY "Coaches update daily_state for assigned" ON daily_state
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_state.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = daily_state.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches write weekly_load for assigned" ON weekly_load;
CREATE POLICY "Coaches write weekly_load for assigned" ON weekly_load
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = weekly_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);

DROP POLICY IF EXISTS "Coaches update weekly_load for assigned" ON weekly_load;
CREATE POLICY "Coaches update weekly_load for assigned" ON weekly_load
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = weekly_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = weekly_load.athlete_id
      AND (
        a.coach_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM coach_athletes ca
          WHERE ca.coach_id = auth.uid() AND ca.athlete_id = a.id
        )
      )
  )
);
