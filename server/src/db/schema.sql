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
