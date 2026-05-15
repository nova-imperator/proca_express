-- Proca Express — PostgreSQL schema
-- Run with: psql "$DATABASE_URL" -f db/schema.sql

-- Emails are normalised to lowercase in application code, so plain TEXT is fine.

CREATE TABLE IF NOT EXISTS admins (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  mobile          TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT,
  designation     TEXT,
  company_name    TEXT,
  company_gst     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS register_requests (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  full_name       TEXT,
  designation     TEXT,
  company_name    TEXT,
  company_gst     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS password_resets_token_idx ON password_resets(token_hash);

-- Devices: stubbed for future phase
CREATE TABLE IF NOT EXISTS devices (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name     TEXT,
  imei            TEXT,
  status          TEXT NOT NULL DEFAULT 'inactive',
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);

-- updated_at trigger for users
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
