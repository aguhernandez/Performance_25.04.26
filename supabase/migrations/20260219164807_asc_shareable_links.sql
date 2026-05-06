/*
  # Shareable Links for ASC Impulse Engine

  ## Summary
  Adds a public-facing shareable link system that allows athletes or coaches
  to generate a time-limited, token-based read-only link to their performance data.

  ## New Tables

  ### `shareable_links`
  - `id` (uuid, PK)
  - `athlete_id` (uuid, FK → athletes.id)
  - `user_id` (uuid, FK → auth.users) — owner
  - `token` (text, unique) — random slug used in the public URL
  - `label` (text) — human-readable name for the link, e.g. "Coach View – March 2026"
  - `expires_at` (timestamptz, nullable) — null = never expires
  - `include_nutrition` (bool, default false) — whether nutrition data is included
  - `include_sessions` (bool, default true)
  - `include_lab` (bool, default false)
  - `view_count` (int, default 0) — audit counter
  - `last_viewed_at` (timestamptz, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled; only the owner (user_id = auth.uid()) can create, read, update, delete links
  - The public read path goes through the Edge Function using the token directly (service role)
  - Token column has a unique index for fast lookup
*/

CREATE TABLE IF NOT EXISTS shareable_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,
  label           text NOT NULL DEFAULT 'Shared Report',
  expires_at      timestamptz,
  include_nutrition  boolean NOT NULL DEFAULT false,
  include_sessions   boolean NOT NULL DEFAULT true,
  include_lab        boolean NOT NULL DEFAULT false,
  view_count      integer NOT NULL DEFAULT 0,
  last_viewed_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shareable_links_token_idx ON shareable_links(token);
CREATE INDEX IF NOT EXISTS shareable_links_user_id_idx ON shareable_links(user_id);

ALTER TABLE shareable_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own links"
  ON shareable_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own links"
  ON shareable_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own links"
  ON shareable_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own links"
  ON shareable_links FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
