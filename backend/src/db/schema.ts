export const SQLITE_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'active',
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  last_active_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY,
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
  unlocked_skins_json TEXT NOT NULL,
  equipped_evolution TEXT NOT NULL DEFAULT 'Baby',
  unlocked_evolutions_json TEXT NOT NULL,
  equipped_trail TEXT NOT NULL DEFAULT 'Classic Dust',
  equipped_accessory TEXT,
  unlocked_accessories_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  mode_stats_json TEXT NOT NULL,
  coupons_json TEXT NOT NULL,
  milestones_json TEXT NOT NULL,
  explorer_json TEXT NOT NULL,
  inventory_json TEXT NOT NULL,
  last_name_change INTEGER,
  last_ad_claim INTEGER,
  last_daily_bonus TEXT,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_streak_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON player_profiles(level);
CREATE INDEX IF NOT EXISTS idx_profiles_region ON player_profiles(preferred_region, country);

CREATE TABLE IF NOT EXISTS missions (
  user_id TEXT NOT NULL,
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
  is_completed INTEGER NOT NULL DEFAULT 0,
  is_claimed INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, mission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL,
  metric TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  is_unlocked INTEGER NOT NULL DEFAULT 0,
  reward_stars INTEGER NOT NULL,
  icon TEXT NOT NULL,
  unlocked_at TEXT,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leaderboard (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  room_id TEXT,
  duration_seconds REAL NOT NULL,
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
  abandoned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  duration_seconds REAL,
  score INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_type_time ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_mode_time ON analytics_events(mode, created_at);

CREATE TABLE IF NOT EXISTS social_graphs (
  user_id TEXT PRIMARY KEY,
  friends_json TEXT NOT NULL DEFAULT '[]',
  incoming_json TEXT NOT NULL DEFAULT '[]',
  outgoing_json TEXT NOT NULL DEFAULT '[]',
  blocked_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_avatar TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  room_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invites_recipient ON match_invites(to_user_id, expires_at);

CREATE TABLE IF NOT EXISTS coupon_definitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  store_name TEXT NOT NULL,
  discount_text TEXT NOT NULL,
  icon TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  expiry_date TEXT NOT NULL,
  regions_json TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 1,
  min_prestige INTEGER NOT NULL DEFAULT 0,
  cost_stars INTEGER NOT NULL DEFAULT 0,
  redemption_limit INTEGER NOT NULL DEFAULT -1,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  auto_grant INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  definition_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  redeemed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_def_user ON coupon_redemptions(definition_id, user_id);

CREATE TABLE IF NOT EXISTS rewards_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  base_star_cost INTEGER NOT NULL,
  regions_json TEXT NOT NULL,
  stock INTEGER NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  destination_url TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ads_placement_active ON advertisements(placement, enabled, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_events (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  user_id TEXT,
  placement TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES advertisements(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ad_events_ad_time ON ad_events(ad_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS ad_reward_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ad_id TEXT,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS anti_cheat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anticheat_time ON anti_cheat_logs(created_at DESC);

-- ── Additive RPG & 1,000-Level Adventure Campaign Migrations (Tables 19–25) ──
CREATE TABLE IF NOT EXISTS player_campaign_progress (
  user_id TEXT PRIMARY KEY,
  adventure_level INTEGER NOT NULL DEFAULT 1,
  highest_unlocked_level INTEGER NOT NULL DEFAULT 1,
  current_world INTEGER NOT NULL DEFAULT 1,
  completed_levels_json TEXT NOT NULL DEFAULT '[]',
  boss_checkpoints_json TEXT NOT NULL DEFAULT '[]',
  milestones_claimed_json TEXT NOT NULL DEFAULT '[]',
  legendary_rewards_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_level ON player_campaign_progress(adventure_level DESC);

CREATE TABLE IF NOT EXISTS quest_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  level_number INTEGER NOT NULL DEFAULT 0,
  npc_id TEXT,
  state TEXT NOT NULL,
  quest_type TEXT NOT NULL,
  is_main INTEGER NOT NULL DEFAULT 1,
  stage_index INTEGER NOT NULL DEFAULT 0,
  stage_total INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 1,
  objective_json TEXT NOT NULL DEFAULT '{}',
  progress_json TEXT NOT NULL DEFAULT '{}',
  reward_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  claimed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_user_state ON quest_sessions(user_id, state);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_user_quest ON quest_sessions(user_id, quest_id, state);

CREATE TABLE IF NOT EXISTS question_bank (
  question_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 1,
  min_level INTEGER NOT NULL DEFAULT 1,
  max_level INTEGER NOT NULL DEFAULT 1000,
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'en',
  tags_json TEXT NOT NULL DEFAULT '[]',
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qbank_cat_diff ON question_bank(category, difficulty, status);
CREATE INDEX IF NOT EXISTS idx_qbank_levels ON question_bank(min_level, max_level, status);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  quest_session_id TEXT,
  level_number INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  seed TEXT NOT NULL,
  question_ids_json TEXT NOT NULL DEFAULT '[]',
  current_index INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  pass_threshold INTEGER NOT NULL DEFAULT 2,
  untimed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id, status);

CREATE TABLE IF NOT EXISTS question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  submitted_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_qattempts_user_q ON question_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_qattempts_time ON question_attempts(created_at DESC);

CREATE TABLE IF NOT EXISTS boss_progress (
  user_id TEXT NOT NULL,
  boss_level INTEGER NOT NULL,
  boss_id TEXT NOT NULL,
  stage_index INTEGER NOT NULL DEFAULT 0,
  stage_total INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_time_ms INTEGER,
  defeated INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, boss_level),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_boss_progress_user ON boss_progress(user_id, defeated);

CREATE TABLE IF NOT EXISTS content_overrides (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS player_reward_box (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  evo_xp INTEGER NOT NULL DEFAULT 0,
  tickets INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unclaimed',
  created_at TEXT NOT NULL,
  collected_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_box_source ON player_reward_box(user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_reward_box_user_status ON player_reward_box(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS npc_quest_quota (
  user_id TEXT NOT NULL,
  npc_id TEXT NOT NULL,
  completed_in_cycle INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  cooldown_until TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, npc_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

export const RPG_MIGRATION_ROLLBACK_SQL = `
DROP TABLE IF EXISTS npc_quest_quota;
DROP TABLE IF EXISTS player_reward_box;
DROP TABLE IF EXISTS content_overrides;
DROP TABLE IF EXISTS boss_progress;
DROP TABLE IF EXISTS question_attempts;
DROP TABLE IF EXISTS quiz_sessions;
DROP TABLE IF EXISTS question_bank;
DROP TABLE IF EXISTS quest_sessions;
DROP TABLE IF EXISTS player_campaign_progress;
`;

