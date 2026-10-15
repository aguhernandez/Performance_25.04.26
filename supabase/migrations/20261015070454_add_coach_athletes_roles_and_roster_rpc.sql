/*
# Roles, coach assignments and coach roster RPC

1. New table: `coach_athletes`
   - id uuid PK, coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE, created_at.
   - UNIQUE (coach_id, athlete_id). Assignment source for coach access.
   - RLS enabled: coach manages own assignments; head_coach/admin read all;
     anon full access for the app's existing dev mode.

2. Role-aware RLS (roles resolved from the profiles TABLE column role, never
   user_metadata). New SELECT policies for head_coach/admin on: athletes,
   sessions, daily_load, daily_state, weekly_load, activity_mmp,
   activity_metrics, activity_durability, athlete_thresholds.
   No pre-existing policy is dropped or altered.

3. New function coach_roster() — ONE RPC returning the whole roster:
   name, sport, coach, latest fitness/fatigue/form, ramp_rate (fitness minus
   fitness 7 days prior), impulse_7d, avg_weekly_impulse_prev_4w (4 full weeks
   before the current partial week), last_session_date, estimated_share_14d
   (share of daily_load rows with quality estimated in the last 14 days),
   latest full-week monotony, cp_watts/ftp_watts for model-CP suggestions.
   Visibility: no session (dev mode) shows all; head_coach/admin see all;
   coach sees athletes assigned via athletes.coach_id or coach_athletes;
   athlete sees own row. SECURITY DEFINER with pinned search_path.
*/

CREATE TABLE IF NOT EXISTS coach_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS coach_athletes_coach_idx ON coach_athletes (coach_id);
CREATE INDEX IF NOT EXISTS coach_athletes_athlete_idx ON coach_athletes (athlete_id);

ALTER TABLE coach_athletes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_head_coach_or_admin() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE (p.id = auth.uid() OR p.hub_user_id = auth.uid()::text)
      AND p.role IN ('head_coach', 'admin')
  );
$$;

DROP POLICY IF EXISTS "Anon manage coach_athletes" ON coach_athletes;
CREATE POLICY "Anon manage coach_athletes" ON coach_athletes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Coach select own assignments" ON coach_athletes;
CREATE POLICY "Coach select own assignments" ON coach_athletes
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid() OR is_head_coach_or_admin());

DROP POLICY IF EXISTS "Coach insert own assignments" ON coach_athletes;
CREATE POLICY "Coach insert own assignments" ON coach_athletes
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid() OR is_head_coach_or_admin());

DROP POLICY IF EXISTS "Coach delete own assignments" ON coach_athletes;
CREATE POLICY "Coach delete own assignments" ON coach_athletes
  FOR DELETE TO authenticated
  USING (coach_id = auth.uid() OR is_head_coach_or_admin());

DO $mig$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'athletes','sessions','daily_load','daily_state','weekly_load',
    'activity_mmp','activity_metrics','activity_durability','athlete_thresholds'
  ] LOOP
    EXECUTE 'DROP POLICY IF EXISTS "Head coach read all ' || t || '" ON ' || t || ';';
    EXECUTE 'CREATE POLICY "Head coach read all ' || t || '" ON ' || t || ' FOR SELECT TO authenticated USING (is_head_coach_or_admin());';
  END LOOP;
END $mig$;

CREATE OR REPLACE FUNCTION coach_roster()
RETURNS TABLE (
  athlete_id uuid,
  name text,
  sport text,
  coach_id text,
  coach_name text,
  fitness numeric,
  fatigue numeric,
  form numeric,
  ramp_rate numeric,
  impulse_7d numeric,
  avg_weekly_impulse_prev_4w numeric,
  last_session_date date,
  estimated_share_14d numeric,
  latest_monotony numeric,
  cp_watts numeric,
  ftp_watts numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_role text := NULL;
  this_week date := date_trunc('week', current_date)::date;
BEGIN
  IF uid IS NOT NULL THEN
    SELECT p.role INTO v_role
    FROM profiles p
    WHERE p.id = uid OR p.hub_user_id = uid::text
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.sport,
    a.coach_id,
    (SELECT p.full_name FROM profiles p
      WHERE p.id::text = a.coach_id OR p.hub_user_id = a.coach_id
      LIMIT 1),
    st.fitness,
    st.fatigue,
    st.form,
    st.ramp_rate,
    (SELECT COALESCE(SUM(dl.impulse), 0)
      FROM daily_load dl
      WHERE dl.athlete_id = a.id AND dl.date > current_date - 7),
    (SELECT AVG(w.total_impulse)
      FROM weekly_load w
      WHERE w.athlete_id = a.id
        AND w.week_start < this_week
        AND w.week_start >= this_week - 28),
    (SELECT MAX(s.session_date)::date
      FROM sessions s
      WHERE s.athlete_id = a.id),
    (SELECT COALESCE(AVG(CASE WHEN dl.quality = 'estimated' THEN 1.0 ELSE 0.0 END), 0)
      FROM daily_load dl
      WHERE dl.athlete_id = a.id AND dl.date > current_date - 14),
    COALESCE(
      (SELECT w.monotony FROM weekly_load w
        WHERE w.athlete_id = a.id AND w.week_start < this_week AND w.monotony IS NOT NULL
        ORDER BY w.week_start DESC LIMIT 1),
      (SELECT w.monotony FROM weekly_load w
        WHERE w.athlete_id = a.id AND w.monotony IS NOT NULL
        ORDER BY w.week_start DESC LIMIT 1)
    ),
    a.cp_watts,
    a.ftp_watts
  FROM athletes a
  CROSS JOIN LATERAL (
    SELECT ds.fitness, ds.fatigue, ds.form,
           ds.fitness - LAG(ds.fitness, 7) OVER (ORDER BY ds.date) AS ramp_rate
    FROM daily_state ds
    WHERE ds.athlete_id = a.id
    ORDER BY ds.date DESC
    LIMIT 8
  ) st
  WHERE
    uid IS NULL
    OR v_role IN ('head_coach', 'admin')
    OR (v_role = 'coach' AND (
      a.coach_id = uid::text
      OR EXISTS (SELECT 1 FROM coach_athletes ca WHERE ca.coach_id = uid AND ca.athlete_id = a.id)
    ))
    OR a.user_id = uid
  ORDER BY a.name ASC;
END $fn$;

GRANT EXECUTE ON FUNCTION coach_roster() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_head_coach_or_admin() TO authenticated;
