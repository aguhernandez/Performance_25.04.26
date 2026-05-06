/*
  # Add Hub Connection Token to Profiles

  ## Summary
  Adds Hub API token management to the profiles table so each profile can
  store its own Hub connection configuration. Only admin profiles will be
  able to set/clear the token (enforced at application level).

  ## Changes
  ### Modified Tables
  - `profiles`
    - `hub_planner_token` (text, nullable): The planner token from Hub (format: planner_xxxxxxxx...)
    - `hub_token_label` (text, nullable): Friendly label for the token
    - `hub_token_set_at` (timestamptz, nullable): When the token was last configured
    - `hub_connection_active` (boolean): Whether the connection is currently active

  ## Security
  - Column is only readable by the profile owner (existing RLS policy covers this)
  - Token is stored encrypted-at-rest by Supabase
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hub_planner_token'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN hub_planner_token text,
      ADD COLUMN hub_token_label text,
      ADD COLUMN hub_token_set_at timestamptz,
      ADD COLUMN hub_connection_active boolean DEFAULT false;
  END IF;
END $$;
