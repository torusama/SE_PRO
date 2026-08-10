-- Tracks one-day-before appointment reminder emails. The appointment date is
-- part of the key so a rescheduled appointment may receive a fresh reminder.
CREATE TABLE IF NOT EXISTS appointment_reminder_deliveries (
    delivery_id         SERIAL PRIMARY KEY,
    appointment_source  VARCHAR(20) NOT NULL
                        CHECK (appointment_source IN ('schedule', 'offline')),
    appointment_id      INT NOT NULL,
    user_id             INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    appointment_date    DATE NOT NULL,
    email               VARCHAR(255) NOT NULL,
    ai_generated        BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (appointment_source, appointment_id, appointment_date, email)
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminder_deliveries_lookup
    ON appointment_reminder_deliveries(appointment_source, appointment_id, appointment_date);
