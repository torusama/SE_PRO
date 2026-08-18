-- Repair AI knowledge-review constraints on databases created from older
-- autonomous-learning drafts. Older installations may already have a CHECK
-- constraint with the same name but without the newer `rejected` value; in
-- that case approving still works while rejecting rolls the whole transaction
-- back when ai_knowledge_versions is written.

BEGIN;

ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_entries_validation_status;
ALTER TABLE ai_knowledge_entries
  ADD CONSTRAINT ck_ai_knowledge_entries_validation_status
  CHECK (validation_status IN (
    'proposed',
    'validating',
    'active',
    'quarantined',
    'rejected',
    'superseded'
  ));

ALTER TABLE ai_knowledge_versions
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_versions_action;
ALTER TABLE ai_knowledge_versions
  ADD CONSTRAINT ck_ai_knowledge_versions_action
  CHECK (
    action_type IS NULL OR action_type IN (
      'created',
      'activated',
      'quarantined',
      'rejected',
      'superseded',
      'restored'
    )
  );

-- Quarantined/rejected/superseded global proposals must never be prompt-active.
UPDATE ai_knowledge_entries
SET is_active = FALSE,
    updated_at = NOW()
WHERE scope = 'global'
  AND validation_status IN ('quarantined', 'rejected', 'superseded')
  AND is_active = TRUE;

COMMIT;
