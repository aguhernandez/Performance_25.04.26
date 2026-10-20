/*
# Fix type mismatch in coach_roster() return columns

athletes.cp_watts and athletes.ftp_watts are integer, but the function
declares them as numeric. Cast them to numeric in the SELECT so the
return types match.
*/

DROP FUNCTION IF EXISTS coach_roster();

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
  ftp_watts numeric,
  suggested_cp numeric,
  cp_suggestion_pending boolean
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
  CROSS JOIN LATERAL (
    SELECT ds.fitness, ds.fatigue, ds.form,
           ds.fitness - LAG(ds.fitness, 7) OVER (ORDER BY ds.date) AS ramp_rate
    FROM daily_state ds
    WHERE ds.athlete_id = a.id
    ORDER BY ds.date DESC
    LIMIT 8
  ) st
  LEFT JOIN cp_est ce ON ce.athlete_id = a.id
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
