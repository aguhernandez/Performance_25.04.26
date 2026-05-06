/*
  # Create profiles table for Asciende Impulse satellite

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - Can match HUB user ID
      - `hub_user_id` (text, unique, not null) - Reference to HUB central user
      - `email` (text, not null) - User email from HUB
      - `full_name` (text, not null) - User display name
      - `role` (text, not null) - 'admin', 'coach', or 'athlete'
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `profiles` table
    - Permissive policy for anon/authenticated since auth is handled by HUB,
      not by Supabase Auth

  3. Notes
    - This satellite does NOT use Supabase Auth for user login.
      Authentication is centralized in hub.asciende.pro.
    - The hub_user_id is used to correlate local profiles with HUB users.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'athlete' CHECK (role IN ('admin', 'coach', 'athlete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_hub_user_id ON profiles(hub_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon and authenticated to read profiles"
  ON profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert profiles"
  ON profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update profiles"
  ON profiles
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
