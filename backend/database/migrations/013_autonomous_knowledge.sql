-- Add fields for autonomous learning and scope control
ALTER TABLE ai_knowledge_entries
ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'user')),
ADD COLUMN owner_user_id INT REFERENCES users(user_id),
ADD COLUMN validation_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (validation_status IN ('proposed', 'validating', 'active', 'quarantined', 'rejected', 'superseded')),
ADD COLUMN source_role VARCHAR(50),
ADD COLUMN source_message_id VARCHAR(150),
ADD COLUMN source_session_id VARCHAR(100),
ADD COLUMN content_hash VARCHAR(255),
ADD COLUMN supersedes_entry_id BIGINT REFERENCES ai_knowledge_entries(knowledge_entry_id),
ADD COLUMN effective_from TIMESTAMPTZ,
ADD COLUMN effective_to TIMESTAMPTZ;

-- Add index on content_hash to prevent exact duplicates quickly
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_hash ON ai_knowledge_entries(content_hash);
