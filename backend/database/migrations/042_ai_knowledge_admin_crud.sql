-- Allow explicit administrator edits/deletions to be represented in the
-- knowledge version journal. The actual knowledge row remains fully audited.
BEGIN;

ALTER TABLE ai_knowledge_versions
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_versions_action;
ALTER TABLE ai_knowledge_versions
  ADD CONSTRAINT ck_ai_knowledge_versions_action
  CHECK (
    action_type IS NULL OR action_type IN (
      'created',
      'activated',
      'updated',
      'deleted',
      'quarantined',
      'rejected',
      'superseded',
      'restored'
    )
  );

COMMIT;
