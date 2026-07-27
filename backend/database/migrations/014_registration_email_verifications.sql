-- Lưu OTP tạm thời cho luồng xác thực email trước khi tạo tài khoản.
-- Không tạo bản ghi users cho đến khi email đã được xác thực và người dùng
-- hoàn tất bước đặt mật khẩu.

CREATE TABLE IF NOT EXISTS registration_email_verifications (
    email                       VARCHAR(255) PRIMARY KEY,
    otp_hash                    VARCHAR(255) NOT NULL,
    otp_expires_at              TIMESTAMPTZ NOT NULL,
    otp_attempts                INT NOT NULL DEFAULT 0,
    otp_last_sent_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at                 TIMESTAMPTZ,
    registration_token_hash     VARCHAR(255),
    registration_token_expires_at TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_email_verifications_expiry
    ON registration_email_verifications(otp_expires_at);
