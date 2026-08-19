BEGIN;

-- Privacy-safe application-level lessons learned from conversation mistakes.
-- These records are intentionally separate from ai_knowledge_entries:
-- they are behavioral guardrails for the agent, not factual business knowledge.
CREATE TABLE IF NOT EXISTS ai_learning_journal_entries (
  learning_journal_id BIGSERIAL PRIMARY KEY,
  lesson_key VARCHAR(160) NOT NULL,
  title VARCHAR(220) NOT NULL,
  summary TEXT NOT NULL,
  prevention_rule TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'conversation',
  source_conversation_id BIGINT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  source_message_id BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  source_type VARCHAR(40) NOT NULL DEFAULT 'conversation_reflection',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleted')),
  auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
  times_observed INT NOT NULL DEFAULT 1 CHECK (times_observed >= 1),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_learning_journal_active_key
  ON ai_learning_journal_entries(lesson_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_learning_journal_status_updated
  ON ai_learning_journal_entries(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_journal_source_conversation
  ON ai_learning_journal_entries(source_conversation_id, last_observed_at DESC);

COMMIT;
