/*
# Fix coach_roster: LEFT JOIN + coach parameter

## Problem
The `coach_roster()` function used `CROSS JOIN LATERAL` on `daily_state`,
which silently dropped every athlete that had no daily_state rows. Since
athletes only get daily_state rows after load recompute, newly onboarded
athletes (or those with no sessions yet) never appeared in the roster.

Additionally, the frontend uses the anon Supabase key (Hub JWT auth, not
Supabase auth), so `auth.uid()` is always NULL inside the RPC. The function's
visibility clause `uid IS NULL → show all` works for dev but cannot filter
per-coach. A new optional parameter `p_coach_hub_id` lets the frontend pass
the signed-in coach's Hub user ID so the roster filters to that coach's
assigned athletes.

## Changes
1. `DROP FUNCTION` + recreate `coach_roster(p_coach_hub_id text DEFAULT NULL)`
   with `LEFT JOIN LATERAL` instead of `CROSS JOIN LATERAL`.
2. Athletes with no daily_state rows now appear with NULL fitness/fatigue/
   form/ramp_rate.
3. Visibility logic extended: if `p_coach_hub_id` is provided, filter to
   athletes where `a.coach_id = p_coach_hub_id` OR a `coach_athletes` row
   exists matching that coach. If `p_coach_hub_id` is NULL, keep the existing
   behavior (uid NULL → all, head_coach/admin → all, coach → via uid).
4. Column type casts and table-qualified references preserved from prior fix.

## Security
- Function remains SECURITY DEFINER, search_path = public.
- No RLS changes. The function does not expose data the caller couldn't
  already read — the `athletes` table has anon SELECT (true) policy.
*/

DROP FUNCTION IF EXISTS coach_roster();
DROP FUNCTION IF EXISTS coach_roster(text);

CREATE OR REPLACE FUNCTION coach_roster(p_coach_hub_id text DEFAULT NULL)
RETURNS TABLE(
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
  ftp_watts numeric,
  suggested_cp numeric,
  cp_suggestion_pending boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WITH mmp_best AS (
    SELECT m.athlete_id AS athlete_id,
      m.duration_s,
      MAX(m.watts) AS best_w
    FROM activity_mmp m
    WHERE m.duration_s IN (300, 600, 1200, 1800)
    GROUP BY m.athlete_id, m.duration_s
  ),
  cp_fit AS (
    SELECT mb.athlete_id AS athlete_id,
      COUNT(*) AS n,
      SUM(1.0 / mb.duration_s) AS sx,
      SUM(mb.best_w) AS sy,
      SUM((1.0 / mb.duration_s) ^ 2) AS sxx,
      SUM((1.0 / mb.duration_s) * mb.best_w) AS sxy
    FROM mmp_best mb
    GROUP BY mb.athlete_id
  ),
  cp_est AS (
    SELECT cf.athlete_id AS athlete_id,
      CASE WHEN cf.n >= 3 AND ABS(cf.n * cf.sxx - cf.sx * cf.sx) > 1e-9
        THEN GREATEST(0, (cf.sy - ((cf.n * cf.sxy - cf.sx * cf.sy) / (cf.n * cf.sxx - cf.sx * cf.sx)) * cf.sx) / cf.n)
      END AS cp
    FROM cp_fit cf
  )
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
    a.cp_watts::numeric,
    a.ftp_watts::numeric,
    ce.cp,
    ce.cp IS NOT NULL AND (
      COALESCE(a.cp_watts, a.ftp_watts) IS NULL
      OR ABS(COALESCE(a.cp_watts, a.ftp_watts) - ce.cp) > 0.05 * ce.cp
    )
  FROM athletes a
  LEFT JOIN LATERAL (
    SELECT ds.fitness, ds.fatigue, ds.form,
      ds.fitness - LAG(ds.fitness, 7) OVER (ORDER BY ds.date) AS ramp_rate
    FROM daily_state ds
    WHERE ds.athlete_id = a.id
    ORDER BY ds.date DESC
    LIMIT 8
  ) st ON true
  LEFT JOIN cp_est ce ON ce.athlete_id = a.id
  WHERE
    -- Frontend passes the coach's Hub user ID for per-coach filtering
    (p_coach_hub_id IS NOT NULL AND (
      a.coach_id = p_coach_hub_id
      OR EXISTS (SELECT 1 FROM coach_athletes ca WHERE ca.coach_id::text = p_coach_hub_id AND ca.athlete_id = a.id)
    ))
    OR
    -- No coach param: fall back to auth.uid()-based visibility
    (p_coach_hub_id IS NULL AND (
      uid IS NULL
      OR v_role IN ('head_coach', 'admin')
      OR (v_role = 'coach' AND (
        a.coach_id = uid::text
        OR EXISTS (SELECT 1 FROM coach_athletes ca WHERE ca.coach_id = uid AND ca.athlete_id = a.id)
      ))
      OR a.user_id = uid
    ))
  ORDER BY a.name ASC;
END;
$$;