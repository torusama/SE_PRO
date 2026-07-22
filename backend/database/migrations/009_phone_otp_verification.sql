-- Xác thực số điện thoại bằng OTP gửi qua SMS — cùng cơ chế với OTP email
-- (hash bcrypt, hết hạn 10 phút, tối đa 5 lần sai, cooldown 60s giữa các lần gửi).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_verified_at        TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_otp_hash             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_otp_expires_at        TIMESTAMP,
    ADD COLUMN IF NOT EXISTS phone_otp_attempts          INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone_otp_last_sent_at      TIMESTAMP;

-- Nếu số điện thoại đổi, trạng thái xác thực cũ phải mất hiệu lực (giống cơ chế
-- đã áp dụng cho email ở migration 004).
CREATE OR REPLACE FUNCTION reset_phone_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    NEW.phone_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_phone_verification ON users;
CREATE TRIGGER trg_reset_phone_verification
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION reset_phone_verification();
