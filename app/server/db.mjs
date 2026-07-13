// Postgres connection pool + schema bootstrap.
//
// Connection is taken from DATABASE_URL when present, otherwise assembled from
// the individual POSTGRES_* variables (the names the bundled db service uses in
// docker-compose). initDb() creates the users table and is retried on startup
// so the app survives Postgres still booting inside Coolify / compose.
import pg from 'pg'

const { Pool } = pg

function connectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL }
  }
  return {
    host: process.env.POSTGRES_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'mrc',
    password: process.env.POSTGRES_PASSWORD || 'mrc',
    database: process.env.POSTGRES_DB || 'mrc',
  }
}

export const pool = new Pool(connectionConfig())

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message)
})

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT,
  phone         TEXT,
  name          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- email / phone are each optional, but unique when present (case-insensitive email).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code            TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  provider             TEXT NOT NULL DEFAULT 'manual',
  provider_ref         TEXT,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
-- One active subscription per user, enforced by the DB (not just the app).
DROP INDEX IF EXISTS subscriptions_user_active;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active
  ON subscriptions (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS usage_daily (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
`

export async function initDb({ retries = 15, delayMs = 2000 } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(SCHEMA)
      console.log('[db] schema ready')
      return
    } catch (err) {
      lastErr = err
      console.warn(`[db] not ready (attempt ${attempt}/${retries}): ${err.message}`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

export async function ping() {
  await pool.query('SELECT 1')
}
