export const schemaSql = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  telegram_username TEXT,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  spore INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1000,
  rated_battle_count INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  friend_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_settings (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'ru',
  reduced_motion INTEGER NOT NULL DEFAULT 0,
  battle_speed TEXT NOT NULL DEFAULT '1x'
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_key TEXT UNIQUE NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  private_code TEXT UNIQUE NOT NULL,
  public_code TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_mushrooms (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mushroom_id TEXT NOT NULL,
  mycelium INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, mushroom_id)
);

CREATE TABLE IF NOT EXISTS player_active_character (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  mushroom_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_artifact_loadouts (
  id TEXT PRIMARY KEY,
  player_id TEXT UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mushroom_id TEXT NOT NULL,
  grid_width INTEGER NOT NULL,
  grid_height INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_artifact_loadout_items (
  id TEXT PRIMARY KEY,
  loadout_id TEXT NOT NULL REFERENCES player_artifact_loadouts(id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_shop_state (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  player_low_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_high_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (player_low_id, player_high_id)
);

CREATE TABLE IF NOT EXISTS friend_challenges (
  id TEXT PRIMARY KEY,
  challenge_token TEXT UNIQUE NOT NULL,
  challenger_player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  invitee_player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  battle_id TEXT
);

CREATE TABLE IF NOT EXISTS battle_requests (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  battle_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (player_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS daily_rate_limits (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  battle_starts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, day_key)
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  initiator_player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  opponent_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  opponent_kind TEXT NOT NULL,
  rated_scope TEXT NOT NULL,
  battle_seed TEXT NOT NULL,
  outcome TEXT NOT NULL,
  winner_side TEXT,
  challenger_challenge_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_snapshots (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  player_id TEXT,
  mushroom_id TEXT NOT NULL,
  mushroom_name TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_events (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  event_index INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_rewards (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mushroom_id TEXT NOT NULL,
  spore_delta INTEGER NOT NULL,
  mycelium_delta INTEGER NOT NULL,
  rating_before INTEGER,
  rating_after INTEGER,
  wins_delta INTEGER NOT NULL DEFAULT 0,
  losses_delta INTEGER NOT NULL DEFAULT 0,
  draws_delta INTEGER NOT NULL DEFAULT 0,
  reward_scope TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_test_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
`;
