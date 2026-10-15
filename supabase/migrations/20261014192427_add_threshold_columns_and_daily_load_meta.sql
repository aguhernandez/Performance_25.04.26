/*
# Thresholds and daily persistence: LT2/threshold-speed columns + meta column

1. Plain-English summary
The impulse engine needs threshold values (LT2 heart rate and running
threshold speed) to compute training impulse intensity. This migration adds
nullable columns on the athlete profile so these values can be stored
per-athlete (priority: Hub biological passport > profile > fallback), and
adds a `meta` column to `daily_load` so every stored row records which
threshold source was used.

2. Modified tables
- `athletes`:
  - `hr_lt2_bpm` (integer, nullable): LT2 heart rate in bpm from the
    biological passport or manual profile entry. NULL = not set.
  - `threshold_speed_kmh` (numeric, nullable): running speed at LT2/VT2 in
    km/h. NULL = not set.
- `daily_load`:
  - `meta` (jsonb, nullable): threshold metadata used for the row, e.g.
    `{"cp_source": "profile", "lt2_hr": 172, "lt2_hr_source": "passport",
    "threshold_speed_kmh": 14.2, "threshold_speed_source": "profile"}`.

3. Security
No policy changes. `daily_load` already has RLS policies covering all verbs
for authenticated owners and anon (single-tenant dev mode); new nullable
columns inherit those policies.

4. Notes
- Both new athlete columns are nullable with no default, so existing rows
  are untouched and the fallback chain (passport > profile > 0.9 x maxHR /
  null) decides at read time.
- Idempotent: conditional column adds via information_schema checks.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'hr_lt2_bpm'
  ) THEN
    ALTER TABLE athletes ADD COLUMN hr_lt2_bpm integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'threshold_speed_kmh'
  ) THEN
    ALTER TABLE athletes ADD COLUMN threshold_speed_kmh numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_load' AND column_name = 'meta'
  ) THEN
    ALTER TABLE daily_load ADD COLUMN meta jsonb;
  END IF;
END $$;
