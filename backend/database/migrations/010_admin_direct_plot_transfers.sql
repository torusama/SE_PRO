-- Admin-driven transfer batches. This replaces application use of the legacy
-- transfer_requests and change_right_* workflows without deleting old records.

CREATE TABLE IF NOT EXISTS admin_transfer_batches (
    batch_id UUID PRIMARY KEY,
    batch_code VARCHAR(40) NOT NULL UNIQUE,
    previous_holder_user_id INT NOT NULL REFERENCES users(user_id),
    recipient_user_id INT NOT NULL REFERENCES users(user_id),
    recipient_snapshot JSONB NOT NULL,
    plot_count INT NOT NULL CHECK (plot_count > 0),
    admin_note TEXT,
    created_by INT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_transfer_batches_previous_holder
    ON admin_transfer_batches(previous_holder_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_transfer_batches_recipient
    ON admin_transfer_batches(recipient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_transfer_items (
    item_id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES admin_transfer_batches(batch_id),
    plot_id INT NOT NULL REFERENCES plots(plot_id),
    previous_ownership_id INT NOT NULL REFERENCES ownership_records(ownership_id),
    previous_contract_id INT NOT NULL REFERENCES contracts(contract_id),
    new_ownership_id INT NOT NULL REFERENCES ownership_records(ownership_id),
    new_contract_id INT NOT NULL REFERENCES contracts(contract_id),
    previous_holder_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, plot_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_transfer_items_plot
    ON admin_transfer_items(plot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_transfer_documents (
    document_id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES admin_transfer_batches(batch_id),
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum_sha256 CHAR(64) NOT NULL,
    uploaded_by INT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE change_right_cases IS
    'LEGACY: no longer used by application code after migration 010.';
