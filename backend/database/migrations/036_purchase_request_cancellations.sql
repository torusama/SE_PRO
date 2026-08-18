-- Customer cancellation workflow for purchase requests.
-- Pending cancellation requests are reviewed by an administrator; immediate
-- cancellations are stored as already approved history records.

CREATE TABLE IF NOT EXISTS purchase_request_cancellations (
    cancellation_id SERIAL PRIMARY KEY,
    request_id      INT NOT NULL REFERENCES reservation_requests(request_id),
    requested_by    INT NOT NULL REFERENCES users(user_id),
    reason          TEXT NOT NULL
                    CHECK (CHAR_LENGTH(BTRIM(reason)) BETWEEN 3 AND 1000),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    is_immediate    BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by     INT REFERENCES users(user_id),
    reviewed_at     TIMESTAMPTZ,
    admin_note      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (NOT is_immediate OR status = 'approved')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_cancellations_one_pending
    ON purchase_request_cancellations(request_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_purchase_cancellations_status_created
    ON purchase_request_cancellations(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_cancellations_requested_by
    ON purchase_request_cancellations(requested_by, created_at DESC);

DROP TRIGGER IF EXISTS trg_purchase_cancellations_updated_at
    ON purchase_request_cancellations;

CREATE TRIGGER trg_purchase_cancellations_updated_at
    BEFORE UPDATE ON purchase_request_cancellations
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
