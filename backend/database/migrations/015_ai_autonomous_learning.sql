-- AI Autonomous Learning and Persistent Memory schema updates

-- 1. Add required fields to ai_knowledge_entries
ALTER TABLE ai_knowledge_entries
ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'user')),
ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS memory_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (validation_status IN ('proposed', 'validating', 'active', 'quarantined', 'rejected', 'superseded')),
ADD COLUMN IF NOT EXISTS validation_reason TEXT,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS source_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_conversation_id BIGINT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_message_id BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS supersedes_entry_id BIGINT REFERENCES ai_knowledge_entries(knowledge_entry_id),
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;

-- 2. Clean up old incorrect conflicts or constraints (if any exist beyond primary keys)
-- The old instructions said: "The current implementation uses: ON CONFLICT (content_hash) DO NOTHING without a matching unique constraint."
-- We will implement the proper unique indexes now.

-- Global knowledge uniqueness: category + content_hash
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_knowledge_global_hash 
ON ai_knowledge_entries(category, content_hash) 
WHERE scope = 'global' AND is_active = TRUE AND validation_status IN ('proposed', 'active');

-- User knowledge uniqueness: owner_user_id + category/memory_key + content_hash
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_knowledge_user_hash 
ON ai_knowledge_entries(owner_user_id, COALESCE(memory_key, category), content_hash) 
WHERE scope = 'user' AND is_active = TRUE AND validation_status IN ('proposed', 'active');

-- 3. Create ai_learning_signals table for recommendation feedback and training data
CREATE TABLE IF NOT EXISTS ai_learning_signals (
    signal_id            BIGSERIAL PRIMARY KEY,
    conversation_id      BIGINT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
    message_id           BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
    user_id              INT REFERENCES users(user_id),
    signal_type          VARCHAR(50) NOT NULL CHECK (signal_type IN ('recommendation_feedback', 'implicit_preference')),
    category             VARCHAR(50) NOT NULL,
    content              TEXT NOT NULL,
    context_data         JSONB,
    model_version        VARCHAR(100),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster ML extraction
CREATE INDEX IF NOT EXISTS idx_ai_learning_signals_type ON ai_learning_signals(signal_type, created_at DESC);
