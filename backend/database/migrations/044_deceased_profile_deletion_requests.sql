-- Cho phép gia đình (chủ lô) gửi YÊU CẦU xoá hồ sơ tưởng niệm tới admin thay
-- vì tự xoá trực tiếp — admin phải duyệt (approve) mới thực sự xoá (soft
-- delete), hoặc có thể từ chối (deny) kèm lý do.

ALTER TABLE deceased_profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by INT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS deletion_denied_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_deceased_deletion_pending
  ON deceased_profiles(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL AND is_deleted = FALSE;
