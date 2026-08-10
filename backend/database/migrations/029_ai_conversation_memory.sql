-- Rolling conversation memory for the AI concierge.
-- Keeps short-lived conversational context separate from durable user preferences/KB.

CREATE TABLE IF NOT EXISTS ai_conversation_memories (
    conversation_memory_id BIGSERIAL PRIMARY KEY,
    conversation_id        BIGINT NOT NULL UNIQUE
                           REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
    user_id                INT REFERENCES users(user_id) ON DELETE SET NULL,
    rolling_summary        TEXT NOT NULL DEFAULT '',
    current_goal           VARCHAR(180),
    unresolved_context     TEXT,
    recent_entities        JSONB NOT NULL DEFAULT '{}'::jsonb,
    correction_notes       JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_intent            VARCHAR(100),
    last_requirements      JSONB,
    last_pending_action    JSONB,
    last_user_message      TEXT,
    last_assistant_message TEXT,
    turn_count             INT NOT NULL DEFAULT 0,
    summary_model          VARCHAR(120),
    summary_updated_at     TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_user
    ON ai_conversation_memories(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_conversation
    ON ai_conversation_memories(conversation_id);
