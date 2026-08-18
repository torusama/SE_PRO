-- Lưu token tạm thời cho luồng "Quên mật khẩu". Token được sinh ngẫu nhiên,
-- chỉ lưu bản băm (hash) trong DB, có hạn dùng và chỉ dùng được 1 lần.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id     SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash   VARCHAR(255) NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
    ON password_reset_tokens(expires_at);
