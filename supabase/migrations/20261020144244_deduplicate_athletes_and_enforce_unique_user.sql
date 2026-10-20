/*
# Deduplicate athletes and enforce one profile per Hub user

## Purpose
The Hub sync was inserting a new `athletes` row on every page reload because
multiple rows already existed for the same `user_id`. The lookup used
`maybeSingle()`, which cannot return one row when duplicates exist, so the sync
fell through to INSERT again.

## Data preservation
1. Select one canonical athlete row per non-null `user_id`, preferring the
   oldest row so the original profile remains stable.
2. Repoint every foreign-key child record from duplicate athlete IDs to the
   canonical athlete ID. This preserves sessions, loads, thresholds, tests,
   charts, scenarios, schedules, links, and health data.
3. Remove duplicate coach assignment links that would collide after merging.
4. Delete only duplicate athlete rows after all child records are repointed.

## Schema protection
- Require `athletes.user_id` to be non-null. Hub-linked athletes must have a
  stable Hub identity.
- Add a unique constraint on `athletes.user_id`, preventing the sync or any
  other client from creating a second athlete profile for the same Hub user.

## Security
- No RLS policies are changed.
- No user data is discarded except redundant athlete rows after their related
  data has been merged into the canonical row.
*/

CREATE TEMP TABLE athlete_dedup_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    a.id AS duplicate_id,
    FIRST_VALUE(a.id) OVER (
      PARTITION BY a.user_id
      ORDER BY a.created_at ASC NULLS LAST, a.id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY a.user_id
      ORDER BY a.created_at ASC NULLS LAST, a.id ASC
    ) AS row_number
  FROM athletes a
  WHERE a.user_id IS NOT NULL
)
SELECT duplicate_id, canonical_id
FROM ranked
WHERE row_number > 1;

DELETE FROM coach_athletes duplicate_links
USING athlete_dedup_map mapping
WHERE duplicate_links.athlete_id = mapping.duplicate_id
  AND EXISTS (
    SELECT 1
    FROM coach_athletes canonical_links
    WHERE canonical_links.coach_id = duplicate_links.coach_id
      AND canonical_links.athlete_id = mapping.canonical_id
  );

DO $$
DECLARE
  child_table record;
BEGIN
  FOR child_table IN
    SELECT DISTINCT
      tc.table_schema,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'athletes'
      AND tc.table_name <> 'coach_athletes'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I child
       SET %I = mapping.canonical_id
       FROM athlete_dedup_map mapping
       WHERE child.%I = mapping.duplicate_id',
      child_table.table_schema,
      child_table.table_name,
      child_table.column_name,
      child_table.column_name
    );
  END LOOP;
END;
$$;

UPDATE coach_athletes links
SET athlete_id = mapping.canonical_id
FROM athlete_dedup_map mapping
WHERE links.athlete_id = mapping.duplicate_id;

DELETE FROM athletes duplicate_athletes
USING athlete_dedup_map mapping
WHERE duplicate_athletes.id = mapping.duplicate_id;

ALTER TABLE athletes
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE athletes
  ADD CONSTRAINT athletes_user_id_unique UNIQUE (user_id);