-- 007_plot_lock_and_availability.sql
-- Additive, non-destructive migration.
-- Does NOT touch plot geometry/map columns (map_x, map_y, map_width, map_height,
-- zone_color, etc.) or any existing view definitions.
-- Safe to run against the existing schema described in DBase.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Plot lock audit trail
--    'locked' is already a valid plots.status value (see update-plot.dto.ts
--    and vw_dashboard_summary.locked_plots), so no status enum change is
--    needed. These columns only add *why/when/who* locked a plot, and let an
--    unlock restore the exact status the plot had before it was locked
--    (e.g. a plot that was 'reserved' goes back to 'reserved', not blindly
--    to 'available').
-- ---------------------------------------------------------------------------
ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by INT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- ---------------------------------------------------------------------------
-- 2. User availability slots
--    A slot is either a recurring weekly slot (day_of_week + is_recurring)
--    or a one-off slot on a specific_date. Any authenticated user (customer,
--    admin, staff) can own slots.
-- ---------------------------------------------------------------------------
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
    (is_recurring = TRUE  AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (is_recurring = FALSE AND specific_date IS NOT NULL AND day_of_week IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_user
  ON availability_slots(user_id, is_active);

-- ---------------------------------------------------------------------------
-- 3. Appointments booked against a slot (or a free-form date/time referencing
--    a host). Kept intentionally simple: one row per requested/confirmed
--    meeting between a requester and a host user.
-- ---------------------------------------------------------------------------
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
  CONSTRAINT chk_appt_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedule_appointments_host_date
  ON schedule_appointments(host_user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_schedule_appointments_requester
  ON schedule_appointments(requester_id);

COMMIT;
