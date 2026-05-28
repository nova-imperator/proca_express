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

-- ============================================================
-- MindLabs integration tables
-- ============================================================
-- We mirror the MindLabs device catalog and store the packet stream that
-- MindLabs pushes to our webhook. Authoritative source for `devices` is
-- MindLabs (their API), but caching id + assignment locally lets us:
--   • assign a device to a user (column user_id below)
--   • render the user's dashboard without a roundtrip
--   • run analytics on `device_packets` without paying MindLabs API quota

-- One-shot migration from the older stub. Only runs if the existing
-- `devices.id` is bigint (the stub shape) — production runs after the first
-- pass become no-ops.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'devices' AND column_name = 'id' AND data_type = 'bigint'
  ) THEN
    DROP TABLE devices CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS devices (
  id                  TEXT PRIMARY KEY,                    -- MindLabs device id, e.g. "AA3630"
  type                TEXT,                                 -- ZN_GO, ZN_ANCHOR, ...
  asset_name          TEXT,                                 -- last seen from packet payload
  personal_reference  TEXT,
  org_id              TEXT,                                 -- MindLabs orgId
  state               TEXT,                                 -- idle | attached | deprecated
  last_seen_at        TIMESTAMPTZ,
  last_battery        INT,
  last_temp_i         NUMERIC,
  last_humid_i        NUMERIC,
  last_lat            NUMERIC,
  last_lng            NUMERIC,
  last_address        TEXT,
  raw_meta            JSONB,                                -- last device snapshot from API
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS devices_set_updated_at ON devices;
CREATE TRIGGER devices_set_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Many-to-many device ↔ user assignments. A device can be shared with
-- multiple users (e.g. operations + finance + ops manager all need to see
-- the same tracker); a user can have any number of devices.
CREATE TABLE IF NOT EXISTS device_assignments (
  device_id    TEXT   NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, user_id)
);
CREATE INDEX IF NOT EXISTS device_assignments_user_idx ON device_assignments(user_id);

-- One-shot migration: lift any single-user `devices.user_id` values into the
-- new join table, then drop the column. Guarded so re-runs are no-ops.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'devices' AND column_name = 'user_id'
  ) THEN
    INSERT INTO device_assignments (device_id, user_id)
    SELECT id, user_id FROM devices WHERE user_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    DROP INDEX IF EXISTS devices_user_idx;
    ALTER TABLE devices DROP COLUMN user_id;
  END IF;
END $$;

-- Time-series sensor packets, append-only. Ingested by the MindLabs webhook.
CREATE TABLE IF NOT EXISTS device_packets (
  id                  BIGSERIAL PRIMARY KEY,
  device_id           TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  packet_time         TIMESTAMPTZ NOT NULL,                 -- from packet.timestamp (unix)
  battery             INT,
  time_interval       INT,
  temp_i              NUMERIC,
  temp_p1             NUMERIC,
  humid_i             NUMERIC,
  lat                 NUMERIC,
  lng                 NUMERIC,
  formatted_address   TEXT,
  raw                 JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, packet_time)                            -- replay-safe
);

CREATE INDEX IF NOT EXISTS device_packets_device_time_idx
  ON device_packets(device_id, packet_time DESC);

-- Light (alsLux) + shock (imuMagnitude) sensors. Added after the original
-- schema, so use ADD COLUMN IF NOT EXISTS + a one-time backfill from the raw
-- JSONB for packets ingested before these columns existed.
ALTER TABLE device_packets ADD COLUMN IF NOT EXISTS light NUMERIC;
ALTER TABLE device_packets ADD COLUMN IF NOT EXISTS shock NUMERIC;
ALTER TABLE devices        ADD COLUMN IF NOT EXISTS last_light NUMERIC;
ALTER TABLE devices        ADD COLUMN IF NOT EXISTS last_shock NUMERIC;

-- Admin-editable friendly label. The raw MindLabs id (e.g. "GF5A001168") is
-- hard to read, so admins can set a human name ("Cold room 3"). Falls back to
-- asset_name / personal_reference / id in the UI when unset.
ALTER TABLE devices        ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill packet light/shock from the stored raw payload where unset.
UPDATE device_packets
   SET light = NULLIF(raw->>'alsLux', '')::numeric,
       shock = NULLIF(raw->>'imuMagnitude', '')::numeric
 WHERE light IS NULL AND shock IS NULL AND raw IS NOT NULL;

-- Backfill each device's last_light / last_shock from its newest packet.
UPDATE devices d
   SET last_light = p.light,
       last_shock = p.shock
  FROM (
    SELECT DISTINCT ON (device_id) device_id, light, shock
      FROM device_packets
     ORDER BY device_id, packet_time DESC
  ) p
 WHERE p.device_id = d.id
   AND d.last_light IS NULL AND d.last_shock IS NULL;

-- Raw audit log of every webhook envelope we receive. Useful for debugging
-- and replaying if our packet parser ever has a bug.
CREATE TABLE IF NOT EXISTS webhook_events (
  id                  BIGSERIAL PRIMARY KEY,
  source              TEXT NOT NULL,                        -- "mindlabs"
  payload_timestamp   BIGINT,                                -- envelope.timestamp
  signature           TEXT,                                  -- envelope.signature
  packet_count        INT,
  raw                 JSONB NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON webhook_events(received_at DESC);
-- De-dupe replays: a {source, timestamp, signature} triple should be unique
-- if MindLabs uses deterministic signatures. Unique-or-not, the index helps lookup.
CREATE INDEX IF NOT EXISTS webhook_events_sig_idx ON webhook_events(source, signature);

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
