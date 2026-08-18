-- AI Cemetery Concierge: conversations, feedback, controlled knowledge and ranker registry.
-- This migration is intentionally additive and idempotent.

CREATE TABLE IF NOT EXISTS ai_conversations (
    conversation_id       BIGSERIAL PRIMARY KEY,
    session_id            VARCHAR(100) NOT NULL UNIQUE,
    user_id               INT REFERENCES users(user_id),
    status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'closed', 'error')),
    llm_model             VARCHAR(100) NOT NULL,
    ranker_version        VARCHAR(50),
    knowledge_version     VARCHAR(50),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
    message_id            BIGSERIAL PRIMARY KEY,
    conversation_id       BIGINT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
    role                   VARCHAR(20) NOT NULL
                           CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content                TEXT,
    intent                 VARCHAR(100),
    extracted_data         JSONB,
    metadata               JSONB,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_tool_calls (
    tool_call_id          BIGSERIAL PRIMARY KEY,
    conversation_id      BIGINT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
    message_id           BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
    external_call_id     VARCHAR(150),
    tool_name            VARCHAR(100) NOT NULL,
    input_data           JSONB,
    output_data          JSONB,
    status               VARCHAR(20) NOT NULL
                         CHECK (status IN ('started', 'success', 'failed')),
    error_message        TEXT,
    execution_time_ms    INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_feedback (
    feedback_id          BIGSERIAL PRIMARY KEY,
    conversation_id     BIGINT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
    message_id          BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
    user_id             INT REFERENCES users(user_id),
    feedback_type       VARCHAR(40) NOT NULL
                        CHECK (feedback_type IN (
                          'helpful', 'bad_recommendation', 'wrong_information',
                          'irrelevant_answer', 'other'
                        )),
    rating              SMALLINT CHECK (rating BETWEEN 1 AND 5),
    original_content    TEXT,
    corrected_content   TEXT,
    reason              TEXT,
    evidence_url        TEXT,
    validation_status   VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (validation_status IN (
                          'pending', 'validating', 'approved', 'rejected', 'applied'
                        )),
    reviewed_by         INT REFERENCES users(user_id),
    review_note         TEXT,
    validated_at        TIMESTAMPTZ,
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
    knowledge_entry_id  BIGSERIAL PRIMARY KEY,
    knowledge_key       VARCHAR(150) NOT NULL,
    category            VARCHAR(50) NOT NULL,
    title               VARCHAR(200) NOT NULL,
    content             TEXT NOT NULL,
    source_type         VARCHAR(30) NOT NULL DEFAULT 'admin',
    source_reference    TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_versions (
    version_id           BIGSERIAL PRIMARY KEY,
    version_name         VARCHAR(50) NOT NULL UNIQUE,
    entity_type          VARCHAR(50) NOT NULL,
    entity_id            BIGINT,
    field_name           VARCHAR(100),
    old_value            JSONB,
    new_value            JSONB,
    feedback_id          BIGINT REFERENCES ai_feedback(feedback_id),
    change_reason        TEXT,
    created_by           INT REFERENCES users(user_id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_training_samples (
    sample_id            BIGSERIAL PRIMARY KEY,
    feedback_id          BIGINT REFERENCES ai_feedback(feedback_id),
    features             JSONB NOT NULL,
    label                JSONB NOT NULL,
    dataset_version      VARCHAR(50) NOT NULL,
    is_approved          BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by          INT REFERENCES users(user_id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_training_runs (
    run_id               BIGSERIAL PRIMARY KEY,
    old_model_version    VARCHAR(50),
    candidate_version    VARCHAR(50) NOT NULL,
    dataset_version      VARCHAR(50) NOT NULL,
    training_sample_count INT NOT NULL DEFAULT 0,
    new_sample_count     INT NOT NULL DEFAULT 0,
    metric_name          VARCHAR(50),
    metric_before        DECIMAL(10,6),
    metric_after         DECIMAL(10,6),
    metrics              JSONB,
    status               VARCHAR(30) NOT NULL
                         CHECK (status IN (
                           'queued', 'running', 'passed', 'failed',
                           'deployed', 'rejected'
                         )),
    training_log         TEXT,
    started_by           INT REFERENCES users(user_id),
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_model_versions (
    model_version_id     BIGSERIAL PRIMARY KEY,
    version_name         VARCHAR(50) NOT NULL UNIQUE,
    algorithm            VARCHAR(100) NOT NULL,
    artifact_path        TEXT NOT NULL,
    dataset_version      VARCHAR(50),
    metrics              JSONB,
    status               VARCHAR(30) NOT NULL
                         CHECK (status IN ('candidate', 'active', 'retired', 'failed')),
    training_run_id      BIGINT REFERENCES ai_training_runs(run_id),
    deployed_by          INT REFERENCES users(user_id),
    deployed_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session
    ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
    ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_status
    ON ai_feedback(validation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_training_runs_status
    ON ai_training_runs(status, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_knowledge_entries_key
    ON ai_knowledge_entries(knowledge_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_versions_active
    ON ai_model_versions(status) WHERE status = 'active';

INSERT INTO ai_knowledge_entries
  (knowledge_key, category, title, content, source_type, source_reference)
VALUES
  (
    'purchase-process-v1',
    'purchase_process',
    'Quy trình tạo yêu cầu mua lô',
    'Chọn phương án phù hợp; tạo yêu cầu nháp; kiểm tra lại thông tin và tổng chi phí; chủ động gửi yêu cầu; chờ quản trị viên xác minh và phê duyệt. Yêu cầu nháp chưa phải giao dịch hoặc thanh toán hoàn tất.',
    'system',
    'AI_AGENT_CODEX_README.md'
  )
ON CONFLICT (knowledge_key) DO NOTHING;
