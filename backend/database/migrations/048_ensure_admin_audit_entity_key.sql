-- Keep the audit schema compatible with admin mutations on databases that
-- were initialized from DBase.sql without replaying all historical migrations.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS entity_key VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_key
  ON audit_logs(entity_type, entity_key)
  WHERE entity_key IS NOT NULL;
