BEGIN;

-- A journal lesson can be promoted to an active, auditable assistant
-- instruction after either bounded LLM review or explicit admin approval.
ALTER TABLE ai_learning_journal_entries
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS knowledge_entry_id BIGINT
    REFERENCES ai_knowledge_entries(knowledge_entry_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluator_model VARCHAR(160),
  ADD COLUMN IF NOT EXISTS evaluation_reason TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

ALTER TABLE ai_learning_journal_entries
  DROP CONSTRAINT IF EXISTS ck_ai_learning_journal_review_status;
ALTER TABLE ai_learning_journal_entries
  ADD CONSTRAINT ck_ai_learning_journal_review_status
  CHECK (review_status IN ('pending', 'auto_approved', 'admin_approved'));

UPDATE ai_learning_journal_entries
SET review_status = 'admin_approved',
    evaluation_reason = COALESCE(
      evaluation_reason,
      'Legacy lesson previously approved through administrator editing.'
    ),
    evaluated_at = COALESCE(evaluated_at, updated_at)
WHERE auto_generated = FALSE
  AND review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_learning_journal_knowledge_entry
  ON ai_learning_journal_entries(knowledge_entry_id)
  WHERE knowledge_entry_id IS NOT NULL;

ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_entries_type;
ALTER TABLE ai_knowledge_entries
  ADD CONSTRAINT ck_ai_knowledge_entries_type
  CHECK (knowledge_type IN (
    'user_preference',
    'business_rule',
    'faq',
    'information_correction',
    'conversation_correction',
    'assistant_instruction'
  ));

COMMIT;
