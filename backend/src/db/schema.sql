-- Zamrud Play schema. Semua nilai koin adalah bilangan bulat (koin virtual, tanpa nilai uang).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  anonymized_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT 'emerald',
  avatar_icon TEXT NOT NULL DEFAULT 'spade',
  bio TEXT NOT NULL DEFAULT '',
  show_on_leaderboard INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id','en')),
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  animation_intensity TEXT NOT NULL DEFAULT 'FULL' CHECK (animation_intensity IN ('FULL','REDUCED','OFF')),
  favorite_categories TEXT NOT NULL DEFAULT '[]',
  preferred_tags TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'any' CHECK (difficulty IN ('any','easy','medium','hard')),
  personalization_enabled INTEGER NOT NULL DEFAULT 1,
  engagement_notifications INTEGER NOT NULL DEFAULT 1,
  high_contrast INTEGER NOT NULL DEFAULT 0,
  tutorial_done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL CHECK (balance >= 0),
  updated_at TEXT NOT NULL
);

-- Buku besar append-only: tidak boleh diubah/dihapus (dijaga trigger di bawah).
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('INITIAL_GRANT','GAME_STAKE','GAME_PAYOUT','DAILY_REWARD','MISSION_REWARD','PROMO_REWARD','ADMIN_ADJUSTMENT','DEMO_RESET')),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  game_session_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wtx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wtx_type_time ON wallet_transactions(type, created_at);
CREATE TRIGGER IF NOT EXISTS wtx_no_update BEFORE UPDATE ON wallet_transactions
BEGIN SELECT RAISE(ABORT, 'wallet_transactions is append-only'); END;
CREATE TRIGGER IF NOT EXISTS wtx_no_delete BEFORE DELETE ON wallet_transactions
BEGIN SELECT RAISE(ABORT, 'wallet_transactions is append-only'); END;

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('SLOTS','WHEEL','CARDS','DICE')),
  tags TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'easy',
  kind TEXT NOT NULL CHECK (kind IN ('INSTANT','INTERACTIVE')),
  name_id TEXT NOT NULL, name_en TEXT NOT NULL,
  desc_id TEXT NOT NULL, desc_en TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active_config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_configs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  config TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (game_id, version)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  config_version INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED')),
  stake INTEGER NOT NULL CHECK (stake >= 0),
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout >= 0),
  seq INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_gs_user_status ON game_sessions(user_id, game_id, status);

CREATE TABLE IF NOT EXISTS game_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE RESTRICT,
  seq INTEGER NOT NULL,
  client_action_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  response TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (session_id, seq),
  UNIQUE (session_id, client_action_id)
);

CREATE TABLE IF NOT EXISTS game_results (
  session_id TEXT PRIMARY KEY REFERENCES game_sessions(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  config_version INTEGER NOT NULL,
  stake INTEGER NOT NULL,
  payout INTEGER NOT NULL,
  net INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gr_user_time ON game_results(user_id, created_at DESC, session_id);
CREATE INDEX IF NOT EXISTS idx_gr_game_time ON game_results(game_id, created_at);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  period TEXT NOT NULL CHECK (period IN ('DAILY','WEEKLY','ONCE')),
  metric TEXT NOT NULL,
  target INTEGER NOT NULL CHECK (target > 0),
  reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  title_id TEXT NOT NULL, title_en TEXT NOT NULL,
  desc_id TEXT NOT NULL, desc_en TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_mission_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  claimed_at TEXT,
  PRIMARY KEY (user_id, mission_id, period_key)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  metric TEXT NOT NULL,
  threshold INTEGER NOT NULL CHECK (threshold > 0),
  icon TEXT NOT NULL DEFAULT 'award',
  name_id TEXT NOT NULL, name_en TEXT NOT NULL,
  desc_id TEXT NOT NULL, desc_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS user_counters (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE IF NOT EXISTS user_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  game_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON user_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ss_user_time ON session_summaries(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_ss_seen ON session_summaries(last_seen_at);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  reward_coins INTEGER NOT NULL CHECK (reward_coins > 0),
  max_redemptions INTEGER NOT NULL DEFAULT 100,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (promo_id, user_id)
);

CREATE TABLE IF NOT EXISTS responsible_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reminder_minutes INTEGER NOT NULL DEFAULT 30 CHECK (reminder_minutes BETWEEN 10 AND 180),
  daily_limit_minutes INTEGER CHECK (daily_limit_minutes IS NULL OR daily_limit_minutes BETWEEN 10 AND 720),
  break_until TEXT,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_seconds BETWEEN 0 AND 300),
  last_round_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_metrics (
  day TEXT PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0
);
