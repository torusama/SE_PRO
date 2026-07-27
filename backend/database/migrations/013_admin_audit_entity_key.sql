-- 013_admin_audit_entity_key.sql
-- Cho phép audit_logs định danh entity dùng UUID mà không đổi entity_id cũ.

BEGIN;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS entity_key VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_key
  ON audit_logs(entity_type, entity_key)
  WHERE entity_key IS NOT NULL;

COMMIT;
