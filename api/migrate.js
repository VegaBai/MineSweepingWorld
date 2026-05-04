import pg from 'pg';
const { Pool } = pg;

function stripSslMode(url) {
  if (!url) return url;
  try { const u = new URL(url); u.searchParams.delete('sslmode'); return u.toString(); }
  catch { return url; }
}

// DDL must run over a direct (non-pooled) connection — pgbouncer blocks CREATE TABLE etc.
function getMigratePool() {
  return new Pool({
    connectionString: stripSslMode(process.env.MSW_POSTGRES_URL_NON_POOLING),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
}

const SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        UNIQUE NOT NULL,
  email         TEXT        UNIQUE,
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS grid_states (
  user_id        UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grid_x         SMALLINT NOT NULL,
  grid_y         SMALLINT NOT NULL,
  status         TEXT     NOT NULL DEFAULT 'active',
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

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  COUNT(*) FILTER (WHERE gs.status = 'won')    AS won_count,
  COUNT(*) FILTER (WHERE gs.status = 'lost')   AS lost_count,
  COUNT(*) FILTER (WHERE gs.status = 'active') AS active_count
FROM users u
LEFT JOIN grid_states gs ON gs.user_id = u.id
GROUP BY u.id, u.username
ORDER BY won_count DESC;

-- Migration 002: user roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'subscriber', 'premium', 'admin'));
UPDATE users SET role = 'admin' WHERE email = 'vegabaixuan@gmail.com';

-- Migration 003: world maps
CREATE TABLE IF NOT EXISTS world_maps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  data       TEXT        NOT NULL,
  width      SMALLINT    NOT NULL DEFAULT 20,
  height     SMALLINT    NOT NULL DEFAULT 16,
  is_active  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// One-time migration — protect with a secret header
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-migrate-secret'] !== process.env.MIGRATE_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const db = getMigratePool();
  await db.query(SQL);
  res.json({ ok: true });
}
