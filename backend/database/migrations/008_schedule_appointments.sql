-- Historical follow-up for schedule tables. Kept as an idempotent migration.
-- The canonical migration directory is backend/database/migrations.
BEGIN;

-- The base schema already owns an `appointments` table for legacy scheduled
-- visits. Direct-meeting requests use a separate table to avoid that collision.
CREATE TABLE IF NOT EXISTS availability_slots (
  slot_id       SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  day_of_week   SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date DATE,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT TRUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slot_time CHECK (end_time > start_time),
  CONSTRAINT chk_slot_kind CHECK (
    (is_recurring = TRUE AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (is_recurring = FALSE AND specific_date IS NOT NULL AND day_of_week IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_user
  ON availability_slots(user_id, is_active);

CREATE TABLE IF NOT EXISTS schedule_appointments (
  appointment_id   SERIAL PRIMARY KEY,
  slot_id          INT REFERENCES availability_slots(slot_id) ON DELETE SET NULL,
  host_user_id     INT NOT NULL REFERENCES users(user_id),
  requester_id     INT NOT NULL REFERENCES users(user_id),
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  note             TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_schedule_appt_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedule_appointments_host_date
  ON schedule_appointments(host_user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_schedule_appointments_requester
  ON schedule_appointments(requester_id);

COMMIT;
