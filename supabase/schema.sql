-- =========================================================================
-- ANACONDA PARK / COILQUEST — SUPABASE POSTGRESQL SCHEMA
-- Execute this entire script in Supabase SQL Editor (Dashboard -> SQL Editor)
-- =========================================================================

-- 1. Game State Snapshot Table (Auto-synced by SupabaseSync.ts via REST API)
CREATE TABLE IF NOT EXISTS public.game_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS but allow service_role key full access
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to game_state"
  ON public.game_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional read policy for anon if you wish to read public global leaderboard
CREATE POLICY "Allow anon read game_state"
  ON public.game_state
  FOR SELECT
  TO anon
  USING (true);

-- 2. Player Profiles Table (For direct relational queries and auth mapping)
CREATE TABLE IF NOT EXISTS public.player_profiles (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT DEFAULT 'boy_sunglasses',
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  stars INT DEFAULT 500,
  tickets INT DEFAULT 5,
  gems INT DEFAULT 0,
  evolution_tier INT DEFAULT 1,
  role TEXT DEFAULT 'explorer',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to player_profiles"
  ON public.player_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read own profile"
  ON public.player_profiles FOR SELECT TO authenticated USING (auth.uid()::text = user_id);

-- 3. Player Hearts & Lives Table (5-Hearts System with 15-min auto-restore)
CREATE TABLE IF NOT EXISTS public.player_hearts (
  user_id TEXT PRIMARY KEY REFERENCES public.player_profiles(user_id) ON DELETE CASCADE,
  hearts INT DEFAULT 5 CHECK (hearts >= 0 AND hearts <= 5),
  max_hearts INT DEFAULT 5,
  heart_shards INT DEFAULT 0 CHECK (heart_shards >= 0),
  shards_required INT DEFAULT 30,
  last_deducted_at TIMESTAMPTZ,
  next_restore_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.player_hearts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to player_hearts"
  ON public.player_hearts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Quest & 1,000-Level Adventure Campaign Progress
CREATE TABLE IF NOT EXISTS public.campaign_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.player_profiles(user_id) ON DELETE CASCADE,
  current_level INT DEFAULT 1,
  highest_level INT DEFAULT 1,
  world_id INT DEFAULT 1,
  quests_completed INT DEFAULT 0,
  bosses_defeated INT DEFAULT 0,
  quest_master_cooldown_until TIMESTAMPTZ,
  quest_master_tasks_completed INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_campaign_user ON public.campaign_progress(user_id);

ALTER TABLE public.campaign_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to campaign_progress"
  ON public.campaign_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Real-Time Global Match Leaderboards & High Scores
CREATE TABLE IF NOT EXISTS public.leaderboard_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'explorer',
  score BIGINT DEFAULT 0,
  kills INT DEFAULT 0,
  items_collected INT DEFAULT 0,
  placement INT DEFAULT 1,
  recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_score ON public.leaderboard_records(mode, score DESC);

ALTER TABLE public.leaderboard_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read leaderboard"
  ON public.leaderboard_records FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow service_role insert leaderboard"
  ON public.leaderboard_records FOR INSERT TO service_role WITH CHECK (true);

-- =========================================================================
-- INITIAL SEED: Create initial empty game_state row if not exists
-- =========================================================================
INSERT INTO public.game_state (id, data, updated_at)
VALUES ('main', '{"users":[],"stats":{"totalRuns":0,"totalScore":0}}'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

