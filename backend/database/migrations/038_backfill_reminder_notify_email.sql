-- Migration 038: Bật email nhắc lịch cho reminder đã tồn tại nhưng chưa có email
BEGIN;

UPDATE reminders
SET notify_email = TRUE,
    notify_emails = ARRAY['email-cua-ban@gmail.com']  -- ← sửa email thật vào đây
WHERE user_id = 3 AND is_deleted = FALSE;

COMMIT;