-- Migration 012: Thêm kênh nhận thông báo qua Gmail cho nhắc lịch
-- (bảng reminders). Cho phép người dùng nhập nhiều email cùng nhận thông
-- báo cho 1 nhắc lịch (notify_emails), ngoài kênh in-app mặc định.
-- notify_email = TRUE khi notify_emails có ít nhất 1 địa chỉ.
-- Idempotent: chạy lại nhiều lần không lỗi (IF NOT EXISTS).

BEGIN;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS notify_email  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_emails TEXT[]  NOT NULL DEFAULT '{}';

COMMIT;