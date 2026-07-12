-- Phase 1: versioned policy and change-of-usage-right case foundation.
-- Rollback: drop the objects created by this migration in reverse dependency order.
-- Legacy contracts/ownership_records remain untouched and are only used for backfill.

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

ALTER TABLE usage_right_records
    ADD CONSTRAINT fk_usage_right_source_case
    FOREIGN KEY (source_case_id) REFERENCES change_right_cases(case_id);

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
