-- Xác thực email bằng OTP: cho cả email đăng nhập của chủ tài khoản VÀ email
-- người liên hệ khẩn cấp. Mã OTP chỉ lưu dạng hash (bcrypt), không lưu plaintext.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified_at              TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_otp_hash                 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_otp_expires_at            TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_otp_attempts              INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_otp_last_sent_at          TIMESTAMP,

    ADD COLUMN IF NOT EXISTS emergency_contact_email_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_hash          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_expires_at    TIMESTAMP,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_attempts      INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS emergency_contact_otp_last_sent_at  TIMESTAMP;

-- Nếu email liên hệ khẩn cấp thay đổi, mã xác thực cũ (nếu có) phải mất hiệu lực.
-- Trigger đơn giản: mỗi lần UPDATE mà emergency_contact_email đổi giá trị thì xoá
-- luôn trạng thái đã xác thực trước đó.
CREATE OR REPLACE FUNCTION reset_emergency_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.emergency_contact_email IS DISTINCT FROM OLD.emergency_contact_email THEN
    NEW.emergency_contact_email_verified_at := NULL;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_emergency_email_verification ON users;
CREATE TRIGGER trg_reset_emergency_email_verification
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION reset_emergency_email_verification();
