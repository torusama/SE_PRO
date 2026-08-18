-- Consolidated additive schema for SE_PRO.
-- Apply once after database/DBase.sql when creating a fresh local database.
-- Historical migrations 002-014 were squashed into this file on 2026-07-26.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Versioned policy and change-of-usage-right case foundation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS change_right_policy_versions (
    policy_version_id BIGSERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL,
    version INT NOT NULL CHECK (version > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by INT NOT NULL REFERENCES users(user_id),
    approved_by INT REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    UNIQUE (code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_change_right_policy_one_published
    ON change_right_policy_versions(code)
    WHERE status = 'PUBLISHED' AND effective_to IS NULL;

CREATE TABLE IF NOT EXISTS usage_right_records (
    usage_right_record_id BIGSERIAL PRIMARY KEY,
    plot_id INT NOT NULL REFERENCES plots(plot_id),
    holder_user_id INT NOT NULL REFERENCES users(user_id),
    contract_id INT NOT NULL REFERENCES contracts(contract_id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'CLOSED', 'ESTATE_PENDING')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    change_reason VARCHAR(40) NOT NULL,
    source_case_id UUID,
    legacy_ownership_id INT UNIQUE REFERENCES ownership_records(ownership_id),
    created_by INT REFERENCES users(user_id),
    approved_by INT REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_right_one_active_per_plot
    ON usage_right_records(plot_id)
    WHERE status IN ('ACTIVE', 'ESTATE_PENDING');

INSERT INTO usage_right_records (
    plot_id, holder_user_id, contract_id, status, effective_from, effective_to,
    change_reason, legacy_ownership_id
)
SELECT o.plot_id, o.user_id, o.contract_id,
       CASE WHEN o.is_current THEN 'ACTIVE' ELSE 'CLOSED' END,
       o.ownership_start, o.ownership_end, 'LEGACY_MIGRATION', o.ownership_id
FROM ownership_records o
ON CONFLICT (legacy_ownership_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS change_right_cases (
    case_id UUID PRIMARY KEY,
    case_code VARCHAR(30) UNIQUE,
    case_type VARCHAR(20) NOT NULL CHECK (case_type IN ('TRANSFER', 'INHERITANCE')),
    plot_id INT NOT NULL REFERENCES plots(plot_id),
    source_contract_id INT NOT NULL REFERENCES contracts(contract_id),
    created_by_user_id INT NOT NULL REFERENCES users(user_id),
    submitted_by_user_id INT REFERENCES users(user_id),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    status_reason_code VARCHAR(80),
    customer_reason TEXT,
    policy_version_id BIGINT REFERENCES change_right_policy_versions(policy_version_id),
    plot_snapshot_json JSONB,
    contract_snapshot_json JSONB,
    current_holder_snapshot_json JSONB,
    submitted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    lock_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN (
      'DRAFT','SUBMITTED','PRE_SCREENING','NEED_SUPPLEMENT','BUSINESS_REVIEW',
      'LEGAL_REVIEW','DISPUTE_HOLD','ELIGIBLE','APPOINTMENT_SCHEDULED',
      'ORIGINALS_VERIFIED','PENDING_SIGNING','SIGNED','PENDING_FINANCIAL',
      'FINAL_REVIEW','APPROVED','REJECTED','WITHDRAWN','CANCELLED','ARCHIVED'
    ))
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_usage_right_source_case'
          AND conrelid = 'usage_right_records'::regclass
    ) THEN
        ALTER TABLE usage_right_records
            ADD CONSTRAINT fk_usage_right_source_case
            FOREIGN KEY (source_case_id) REFERENCES change_right_cases(case_id);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_change_right_one_active_case_per_plot
    ON change_right_cases(plot_id)
    WHERE status NOT IN ('DRAFT','APPROVED','REJECTED','WITHDRAWN','CANCELLED','ARCHIVED');

CREATE TABLE IF NOT EXISTS change_right_case_parties (
    party_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    user_id INT REFERENCES users(user_id),
    party_type VARCHAR(40) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    identity_number_encrypted TEXT,
    identity_number_last4 VARCHAR(4),
    date_of_birth DATE,
    email VARCHAR(255),
    phone VARCHAR(30),
    relationship_to_deceased VARCHAR(100),
    is_minor BOOLEAN NOT NULL DEFAULT FALSE,
    requires_representative BOOLEAN NOT NULL DEFAULT FALSE,
    consent_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    verification_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_right_case_requirements (
    requirement_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    requirement_code VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'MISSING',
    policy_item_version INT NOT NULL,
    requested_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    validated_by INT REFERENCES users(user_id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (case_id, requirement_code)
);

CREATE TABLE IF NOT EXISTS change_right_case_documents (
    document_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    requirement_id UUID REFERENCES change_right_case_requirements(requirement_id),
    document_type VARCHAR(100) NOT NULL,
    file_object_id VARCHAR(255) NOT NULL,
    version INT NOT NULL CHECK (version > 0),
    original_filename VARCHAR(255) NOT NULL,
    normalized_filename VARCHAR(255) NOT NULL,
    declared_mime_type VARCHAR(150) NOT NULL,
    detected_mime_type VARCHAR(150),
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum_sha256 CHAR(64) NOT NULL,
    malware_scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (malware_scan_status IN ('PENDING','CLEAN','INFECTED','FAILED')),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    visibility VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_ONLY',
    uploaded_by INT NOT NULL REFERENCES users(user_id),
    original_seen BOOLEAN NOT NULL DEFAULT FALSE,
    original_seen_at TIMESTAMPTZ,
    original_seen_by INT REFERENCES users(user_id),
    replaces_document_id UUID REFERENCES change_right_case_documents(document_id),
    invalidated_at TIMESTAMPTZ,
    invalidated_by INT REFERENCES users(user_id),
    invalidation_reason TEXT,
    immutable_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (case_id, document_type, version)
);

CREATE TABLE IF NOT EXISTS change_right_case_communications (
    communication_id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    sender_id INT NOT NULL REFERENCES users(user_id),
    message_type VARCHAR(40) NOT NULL,
    body TEXT NOT NULL,
    visibility VARCHAR(30) NOT NULL
        CHECK (visibility IN ('CUSTOMER_VISIBLE','INTERNAL_ONLY','SELECTED_PARTIES')),
    reply_to_id UUID REFERENCES change_right_case_communications(communication_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_right_plot_locks (
    plot_lock_id UUID PRIMARY KEY,
    plot_id INT NOT NULL REFERENCES plots(plot_id),
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    lock_type VARCHAR(40) NOT NULL,
    released_at TIMESTAMPTZ,
    released_by INT REFERENCES users(user_id),
    release_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_change_right_one_open_plot_lock
    ON change_right_plot_locks(plot_id) WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS change_right_audit_events (
    audit_event_id UUID PRIMARY KEY,
    actor_user_id INT REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    case_id UUID REFERENCES change_right_cases(case_id),
    before_json JSONB,
    after_json JSONB,
    reason TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_right_change_events (
    change_event_id UUID PRIMARY KEY,
    plot_id INT NOT NULL REFERENCES plots(plot_id),
    case_id UUID NOT NULL REFERENCES change_right_cases(case_id),
    from_usage_right_record_id BIGINT REFERENCES usage_right_records(usage_right_record_id),
    to_usage_right_record_id BIGINT REFERENCES usage_right_records(usage_right_record_id),
    event_type VARCHAR(50) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL,
    summary TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(user_id),
    approved_by INT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_right_outbox_events (
    outbox_event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload_json JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0
);

-- Deliberately DRAFT and without legal document requirements. An authorized admin
-- must complete and publish a policy before customers can submit cases.
INSERT INTO change_right_policy_versions (code, version, configuration_json, created_by)
SELECT 'DEFAULT_CHANGE_RIGHT', 1,
       '{"allow_transfer":true,"allow_gift":true,"allow_inheritance":true,"allow_multiple_holders":false,"require_legal_review":true,"require_original_inspection":true,"require_finance_clearance":true,"approval_levels":2,"document_requirements":{},"contract_template_ids":{}}'::jsonb,
       u.user_id
FROM users u
WHERE LOWER(u.role) = 'admin' AND u.is_active = TRUE AND u.is_deleted = FALSE
ORDER BY u.user_id
LIMIT 1
ON CONFLICT (code, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Customer profile and account security
-- ---------------------------------------------------------------------------

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nationality                  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS city                         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ward                         VARCHAR(150),
    ADD COLUMN IF NOT EXISTS postal_code                  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_name       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_relation   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_email      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS notes                         TEXT,
    ADD COLUMN IF NOT EXISTS notify_payment               BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_service               BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_anniversary           BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_announcement          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS password_changed_at          TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_otp_hash            VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_otp_expires_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_otp_attempts        INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS password_otp_last_sent_at    TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_verified_at            TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_otp_hash               VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_otp_expires_at         TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_otp_attempts           INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_otp_last_sent_at       TIMESTAMP,
    ADD COLUMN IF NOT EXISTS emergency_contact_email_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_hash   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_last_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_verified_at            TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_otp_hash               VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_otp_expires_at         TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_otp_attempts           INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone_otp_last_sent_at       TIMESTAMP;

CREATE OR REPLACE FUNCTION reset_emergency_email_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.emergency_contact_email IS DISTINCT FROM OLD.emergency_contact_email THEN
        NEW.emergency_contact_email_verified_at := NULL;
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        NEW.email_verified_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_emergency_email_verification ON users;
CREATE TRIGGER trg_reset_emergency_email_verification
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION reset_emergency_email_verification();

CREATE OR REPLACE FUNCTION reset_phone_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
        NEW.phone_verified_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_phone_verification ON users;
CREATE TRIGGER trg_reset_phone_verification
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION reset_phone_verification();

CREATE TABLE IF NOT EXISTS user_sessions (
    id              SERIAL PRIMARY KEY,
    jti             VARCHAR(64) NOT NULL UNIQUE,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_label    VARCHAR(255),
    browser         VARCHAR(100),
    os              VARCHAR(100),
    ip_address      VARCHAR(64),
    user_agent      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti
    ON user_sessions(jti);

CREATE TABLE IF NOT EXISTS user_authorized_persons (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name   VARCHAR(150) NOT NULL,
    relation    VARCHAR(50),
    phone       VARCHAR(20),
    email       VARCHAR(255),
    permission  VARCHAR(30) NOT NULL DEFAULT 'view'
                CHECK (permission IN ('view', 'view_and_service')),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authorized_persons_user
    ON user_authorized_persons(user_id);

-- ---------------------------------------------------------------------------
-- 3. Contract content, signatures and generated PDF metadata
-- ---------------------------------------------------------------------------

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS contract_content TEXT,
    ADD COLUMN IF NOT EXISTS inheritance_content TEXT,
    ADD COLUMN IF NOT EXISTS inheritance_updated_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS inheritance_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS party_a_signed_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS party_a_signature_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS party_a_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS party_a_signature_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS party_b_signed_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS party_b_signature_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS party_b_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS party_b_signature_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS pdf_uploaded_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_request_plot
    ON contracts(request_id, plot_id)
    WHERE request_id IS NOT NULL AND is_deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 4. Offline contract-signing appointments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offline_appointments (
    appointment_id      SERIAL PRIMARY KEY,
    request_id          INT NOT NULL REFERENCES reservation_requests(request_id),
    user_id             INT NOT NULL REFERENCES users(user_id),
    scheduled_at        TIMESTAMPTZ NOT NULL,
    location            TEXT NOT NULL,
    assigned_staff_id   INT REFERENCES users(user_id),
    assigned_staff_name VARCHAR(100),
    status              VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    note                TEXT,
    status_note         TEXT,
    created_by          INT NOT NULL REFERENCES users(user_id),
    updated_by          INT REFERENCES users(user_id),
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- ---------------------------------------------------------------------------
-- 5. Direct meeting availability and appointments
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
        (is_recurring = TRUE AND day_of_week IS NOT NULL AND specific_date IS NULL)
        OR
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
    CONSTRAINT chk_appt_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedule_appointments_host_date
    ON schedule_appointments(host_user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_schedule_appointments_requester
    ON schedule_appointments(requester_id);

-- ---------------------------------------------------------------------------
-- 6. Admin-driven plot transfer batches
-- ---------------------------------------------------------------------------

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
    'LEGACY: no longer used by application code after the consolidated baseline.';

-- ---------------------------------------------------------------------------
-- 7. Cemetery zones E-H and their initial plots
-- ---------------------------------------------------------------------------

INSERT INTO cemetery_zones (
    zone_code, zone_name, description, map_x, map_y,
    map_width, map_height, color_hex, sort_order
)
VALUES
    ('E', 'Khu E - Cải táng',   'Khu vực dành cho mộ cải táng, quy trình di dời/an táng lại theo đúng nghi thức truyền thống.', 0,   0, 300, 250, '#CDEFF6', 5),
    ('F', 'Khu F - Mật độ cao', 'Khu vực mật độ cao, diện tích mỗi lô nhỏ gọn, mức giá tối ưu cho ngân sách vừa phải.',        310, 0, 300, 250, '#DCF3E4', 6),
    ('G', 'Khu G - Mở rộng',    'Khu mở rộng mới, không gian rộng rãi, còn nhiều lô đẹp để lựa chọn vị trí.',                    0, 260, 300, 300, '#CDEFDD', 7),
    ('H', 'Khu H - Mộ đơn',     'Khu bố trí các mộ đơn lẻ, phù hợp nhu cầu an táng cá nhân với chi phí hợp lý.',                310, 260, 300, 300, '#FBE6C8', 8)
ON CONFLICT (zone_code) DO NOTHING;

INSERT INTO plots (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
SELECT * FROM (VALUES
    ('E-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.0, 28000000::numeric, 'Nam',   'single', 'available'),
    ('E-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '002',  55,  10, 40, 40, 3.0, 28000000, 'Nam',   'single', 'available'),
    ('E-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '003', 100,  10, 40, 40, 3.0, 29000000, 'Đông',  'single', 'available'),
    ('E-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '004', 145,  10, 40, 40, 3.0, 29000000, 'Đông',  'single', 'available'),
    ('E-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '01', '005', 190,  10, 40, 40, 3.0, 28000000, 'Nam',   'single', 'available'),
    ('E-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '001',  10,  60, 40, 40, 3.0, 27000000, 'Tây',   'single', 'available'),
    ('E-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '002',  55,  60, 40, 40, 3.0, 27000000, 'Tây',   'single', 'available'),
    ('E-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '003', 100,  60, 40, 40, 3.0, 28000000, 'Bắc',   'single', 'available'),
    ('E-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '004', 145,  60, 40, 40, 3.0, 28000000, 'Bắc',   'single', 'available'),
    ('E-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'E'), '02', '005', 190,  60, 40, 40, 3.0, 27000000, 'Nam',   'single', 'available')
) AS values_to_insert (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
ON CONFLICT (plot_code) DO NOTHING;

INSERT INTO plots (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
SELECT * FROM (VALUES
    ('F-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '001',  10::float,  10::float, 35::float, 35::float, 2.4, 24000000::numeric, 'Nam',   'single', 'available'),
    ('F-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '002',  50,  10, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
    ('F-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '003',  90,  10, 35, 35, 2.4, 25000000, 'Đông',  'single', 'available'),
    ('F-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '004', 130,  10, 35, 35, 2.4, 25000000, 'Đông',  'single', 'available'),
    ('F-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '005', 170,  10, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
    ('F-01-006', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '01', '006', 210,  10, 35, 35, 2.4, 23000000, 'Tây',   'single', 'available'),
    ('F-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '001',  10,  55, 35, 35, 2.4, 23000000, 'Tây',   'single', 'available'),
    ('F-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '002',  50,  55, 35, 35, 2.4, 23000000, 'Bắc',   'single', 'available'),
    ('F-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '003',  90,  55, 35, 35, 2.4, 24000000, 'Bắc',   'single', 'available'),
    ('F-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '004', 130,  55, 35, 35, 2.4, 24000000, 'Nam',   'single', 'available'),
    ('F-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '005', 170,  55, 35, 35, 2.4, 23000000, 'Nam',   'single', 'available'),
    ('F-02-006', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'F'), '02', '006', 210,  55, 35, 35, 2.4, 22000000, 'Đông',  'single', 'available')
) AS values_to_insert (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
ON CONFLICT (plot_code) DO NOTHING;

INSERT INTO plots (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
SELECT * FROM (VALUES
    ('G-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.2, 36000000::numeric, 'Nam',   'single', 'available'),
    ('G-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '002',  55,  10, 40, 40, 3.2, 36000000, 'Nam',   'single', 'available'),
    ('G-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '003', 100,  10, 40, 40, 3.2, 37000000, 'Đông',  'single', 'available'),
    ('G-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '004', 145,  10, 40, 40, 3.2, 37000000, 'Đông',  'single', 'available'),
    ('G-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '01', '005', 190,  10, 40, 40, 3.2, 36000000, 'Nam',   'single', 'available'),
    ('G-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '001',  10,  60, 40, 40, 3.2, 35000000, 'Tây',   'single', 'available'),
    ('G-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '002',  55,  60, 40, 40, 3.2, 35000000, 'Tây',   'single', 'available'),
    ('G-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '003', 100,  60, 40, 40, 3.2, 36000000, 'Bắc',   'single', 'available'),
    ('G-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '004', 145,  60, 40, 40, 3.2, 36000000, 'Bắc',   'single', 'available'),
    ('G-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'G'), '02', '005', 190,  60, 40, 40, 3.2, 35000000, 'Nam',   'single', 'available')
) AS values_to_insert (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
ON CONFLICT (plot_code) DO NOTHING;

INSERT INTO plots (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
SELECT * FROM (VALUES
    ('H-01-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '001',  10::float,  10::float, 40::float, 40::float, 3.0, 30000000::numeric, 'Nam',   'single', 'available'),
    ('H-01-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '002',  55,  10, 40, 40, 3.0, 30000000, 'Nam',   'single', 'available'),
    ('H-01-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '003', 100,  10, 40, 40, 3.0, 31000000, 'Đông',  'single', 'available'),
    ('H-01-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '004', 145,  10, 40, 40, 3.0, 31000000, 'Đông',  'single', 'available'),
    ('H-01-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '01', '005', 190,  10, 40, 40, 3.0, 30000000, 'Nam',   'single', 'available'),
    ('H-02-001', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '001',  10,  60, 40, 40, 3.0, 29000000, 'Tây',   'single', 'available'),
    ('H-02-002', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '002',  55,  60, 40, 40, 3.0, 29000000, 'Tây',   'single', 'available'),
    ('H-02-003', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '003', 100,  60, 40, 40, 3.0, 30000000, 'Bắc',   'single', 'available'),
    ('H-02-004', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '004', 145,  60, 40, 40, 3.0, 30000000, 'Bắc',   'single', 'available'),
    ('H-02-005', (SELECT zone_id FROM cemetery_zones WHERE zone_code = 'H'), '02', '005', 190,  60, 40, 40, 3.0, 29000000, 'Nam',   'single', 'available')
) AS values_to_insert (
    plot_code, zone_id, row_number, column_number, map_x, map_y,
    map_width, map_height, area_sqm, price, direction, plot_type, status
)
ON CONFLICT (plot_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Backfill initial service-order history
-- ---------------------------------------------------------------------------

INSERT INTO service_order_history (
    order_id,
    changed_by,
    action,
    previous_status,
    new_status,
    assigned_to,
    note,
    created_at
)
SELECT
    service_order.order_id,
    service_order.user_id,
    'submitted',
    NULL,
    service_order.status,
    service_order.assigned_to,
    service_order.note,
    service_order.created_at
FROM service_orders AS service_order
WHERE NOT EXISTS (
    SELECT 1
    FROM service_order_history AS history
    WHERE history.order_id = service_order.order_id
);

COMMIT;
