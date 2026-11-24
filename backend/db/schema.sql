-- Bill Check database schema. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'cashier', 'driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- created -> assigned -> loaded -> left -> delivered   (or cancelled)
  CREATE TYPE bill_status AS ENUM ('created', 'assigned', 'loaded', 'left', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  emp_id        TEXT NOT NULL UNIQUE,          -- login ID, e.g. "CSH-01"
  name          TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- unique ID
  bill_no          TEXT NOT NULL UNIQUE,
  receiver_name    TEXT NOT NULL,
  receiver_phone   TEXT NOT NULL,
  address          TEXT,
  lot_details      TEXT,                                         -- what is in the load
  status           bill_status NOT NULL DEFAULT 'created',
  cashier_id       INTEGER NOT NULL REFERENCES users(id),
  cashier_name     TEXT NOT NULL,                                -- stamped at creation
  driver_id        INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),           -- clock starts
  assigned_at      TIMESTAMPTZ,
  loaded_at        TIMESTAMPTZ,
  left_at          TIMESTAMPTZ,
  reached_at       TIMESTAMPTZ,                                  -- clock ends (OTP verified)
  cancelled_at     TIMESTAMPTZ,
  otp_hash         TEXT,
  otp_expires_at   TIMESTAMPTZ,
  otp_attempts     INTEGER NOT NULL DEFAULT 0,
  otp_sent_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS bills_driver_status_idx ON bills (driver_id, status);
CREATE INDEX IF NOT EXISTS bills_created_at_idx ON bills (created_at DESC);

-- Every step of every bill, for history and audit.
CREATE TABLE IF NOT EXISTS bill_events (
  id         BIGSERIAL PRIMARY KEY,
  bill_id    UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  event      TEXT NOT NULL,
  actor_id   INTEGER REFERENCES users(id),
  actor_name TEXT,
  note       TEXT,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bill_events_bill_idx ON bill_events (bill_id, at);
