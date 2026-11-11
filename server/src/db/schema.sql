CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS readings (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot         VARCHAR(20) NOT NULL CHECK (slot IN ('morning', 'after_breakfast', 'after_lunch', 'after_dinner')),
  value        INTEGER NOT NULL CHECK (value BETWEEN 40 AND 600),
  notes        VARCHAR(280),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reading_date, slot)
);
CREATE INDEX IF NOT EXISTS readings_user_date_idx ON readings (user_id, reading_date);

-- A patient shares their data with a doctor (patient-initiated consent).
CREATE TABLE IF NOT EXISTS doctor_patients (
  doctor_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, patient_id)
);

-- ---------------------------------------------------------------------------
-- v2: per-user timezone & targets, tags, doctor comments/verification,
--     email verification / password reset, reminders and web push.
-- All statements are idempotent so existing databases upgrade in place.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone           VARCHAR(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS fasting_low        INTEGER NOT NULL DEFAULT 70;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fasting_high       INTEGER NOT NULL DEFAULT 130;
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_low           INTEGER NOT NULL DEFAULT 70;
ALTER TABLE users ADD COLUMN IF NOT EXISTS post_high          INTEGER NOT NULL DEFAULT 180;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_status      VARCHAR(10) CHECK (doctor_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number     VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_enabled   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_time      VARCHAR(5) NOT NULL DEFAULT '20:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_email     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_push      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reminded_date DATE;
-- Doctors that existed before verification was introduced stay usable.
UPDATE users SET doctor_status = 'verified' WHERE role = 'doctor' AND doctor_status IS NULL;

ALTER TABLE readings ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS doctor_comments (
  id           SERIAL PRIMARY KEY,
  doctor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_date DATE NOT NULL,
  body         VARCHAR(1000) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_comments_patient_idx ON doctor_comments (patient_id, comment_date);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(10) NOT NULL CHECK (kind IN ('reset', 'verify')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
