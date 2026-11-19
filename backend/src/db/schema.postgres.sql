-- Production PostgreSQL / Supabase relational schema for Anaconda Park
-- Apply when migrating from single-node SQLite to managed PostgreSQL / Supabase Postgres.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'active',
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  title TEXT,
  country TEXT,
  language TEXT,
  preferred_region TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  evolution_xp INTEGER NOT NULL DEFAULT 0,
  prestige INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1000,
  stars INTEGER NOT NULL DEFAULT 500,
  tickets INTEGER NOT NULL DEFAULT 5,
  friend_code TEXT NOT NULL UNIQUE,
  equipped_skin TEXT NOT NULL DEFAULT 'Forest',
  unlocked_skins JSONB NOT NULL DEFAULT '["Forest","Jungle"]'::jsonb,
  equipped_evolution TEXT NOT NULL DEFAULT 'Baby',
  unlocked_evolutions JSONB NOT NULL DEFAULT '["Baby"]'::jsonb,
  equipped_trail TEXT NOT NULL DEFAULT 'Classic Dust',
  equipped_accessory TEXT,
  unlocked_accessories JSONB NOT NULL DEFAULT '["flower_crown"]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  mode_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  coupons JSONB NOT NULL DEFAULT '[]'::jsonb,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  explorer JSONB NOT NULL DEFAULT '{"kingdom":1,"accepted":[],"claimed":[],"kingdomsDone":[],"bossesDefeated":[],"baseline":{}}'::jsonb,
  inventory JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_name_change BIGINT,
  last_ad_claim BIGINT,
  last_daily_bonus TEXT,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_streak_date TEXT
);

CREATE TABLE IF NOT EXISTS missions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  metric TEXT NOT NULL,
  icon TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  reward_stars INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL,
  reward_evo_xp INTEGER NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  period_key TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, mission_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL,
  metric TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  reward_stars INTEGER NOT NULL,
  icon TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  room_id TEXT,
  duration_seconds DOUBLE PRECISION NOT NULL,
  score INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  highest_combo INTEGER NOT NULL,
  food_collected INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  evo_xp INTEGER NOT NULL,
  rank INTEGER,
  rewards TEXT,
  map TEXT,
  result TEXT NOT NULL,
  abandoned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_match_history_user_time ON match_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_mode_time ON match_history(mode, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  mode TEXT,
  room_id TEXT,
  duration_seconds DOUBLE PRECISION,
  score INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_type_time ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON analytics_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  destination_url TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ads_placement_active ON advertisements(placement, enabled, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_events (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id TEXT,
  placement TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_events_ad_time ON ad_events(ad_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit_logs(created_at DESC);

