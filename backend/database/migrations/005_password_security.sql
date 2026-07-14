-- (1) Lưu thời điểm đổi mật khẩu gần nhất thật sự (không dùng chung updated_at vì
--     cột đó bị các thao tác khác của hồ sơ đụng vào liên tục).
-- (2) Thêm cột OTP riêng cho hành động "đổi mật khẩu" — gửi tới email đăng nhập,
--     bắt buộc nhập đúng mã trước khi đổi được mật khẩu.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_changed_at        TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_otp_hash           VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_otp_expires_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_otp_attempts        INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS password_otp_last_sent_at    TIMESTAMP;

-- Với user đã có sẵn trong DB, không biết chính xác lần đổi mật khẩu gần nhất là
-- khi nào -> để NULL (frontend hiển thị "Chưa có dữ liệu" thay vì bịa ngày tháng).
