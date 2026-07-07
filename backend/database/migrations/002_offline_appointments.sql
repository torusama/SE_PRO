-- Offline contract-signing appointments for approved purchase requests.
-- Apply after backend/database/DBase.sql.

CREATE TABLE IF NOT EXISTS offline_appointments (
    appointment_id      SERIAL          PRIMARY KEY,
    request_id          INT             NOT NULL REFERENCES reservation_requests(request_id),
    user_id             INT             NOT NULL REFERENCES users(user_id),
    scheduled_at        TIMESTAMPTZ     NOT NULL,
    location            TEXT            NOT NULL,
    assigned_staff_id   INT             REFERENCES users(user_id),
    assigned_staff_name VARCHAR(100),
    status              VARCHAR(20)     NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    note                TEXT,
    status_note         TEXT,
    created_by          INT             NOT NULL REFERENCES users(user_id),
    updated_by          INT             REFERENCES users(user_id),
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_appt_request
    ON offline_appointments(request_id);

CREATE INDEX IF NOT EXISTS idx_offline_appt_user
    ON offline_appointments(user_id);

CREATE INDEX IF NOT EXISTS idx_offline_appt_status
    ON offline_appointments(status);

CREATE INDEX IF NOT EXISTS idx_offline_appt_scheduled_at
    ON offline_appointments(scheduled_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_appt_one_scheduled_per_request
    ON offline_appointments(request_id)
    WHERE status = 'scheduled' AND is_deleted = FALSE;

CREATE OR REPLACE FUNCTION fn_offline_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_offline_appointments_updated_at ON offline_appointments;
CREATE TRIGGER trg_offline_appointments_updated_at
    BEFORE UPDATE ON offline_appointments
    FOR EACH ROW EXECUTE FUNCTION fn_offline_appointments_updated_at();
