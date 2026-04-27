-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        UNIQUE NOT NULL,
  email         TEXT        UNIQUE,
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Refresh tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  TEXT        PRIMARY KEY,  -- SHA-256 of the raw token
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

-- ── Grid states ────────────────────────────────────────────────────────────
-- mines/revealed/flagged stored as raw BYTEA (Uint8Array serialised as-is).
-- Max size: MASTER 30×50 = 1500 bytes per array → ~4.5 KB per row.
CREATE TABLE IF NOT EXISTS grid_states (
  user_id        UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grid_x         SMALLINT NOT NULL,
  grid_y         SMALLINT NOT NULL,
  status         TEXT     NOT NULL DEFAULT 'active',  -- active | won | lost
  mines          BYTEA,
  revealed       BYTEA,
  flagged        BYTEA,
  flag_count     SMALLINT DEFAULT 0,
  revealed_count SMALLINT DEFAULT 0,
  first_click    BOOLEAN  DEFAULT TRUE,
  hit_idx        SMALLINT DEFAULT -1,
  elapsed_sec    INT      DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, grid_x, grid_y)
);
CREATE INDEX IF NOT EXISTS idx_gs_user   ON grid_states(user_id);
CREATE INDEX IF NOT EXISTS idx_gs_status ON grid_states(status);

-- ── Leaderboard view (wins per user) ───────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  COUNT(*) FILTER (WHERE gs.status = 'won')  AS won_count,
  COUNT(*) FILTER (WHERE gs.status = 'lost') AS lost_count,
  COUNT(*) FILTER (WHERE gs.status = 'active') AS active_count
FROM users u
LEFT JOIN grid_states gs ON gs.user_id = u.id
GROUP BY u.id, u.username
ORDER BY won_count DESC;