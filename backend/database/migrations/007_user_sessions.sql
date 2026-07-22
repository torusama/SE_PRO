-- Theo dõi phiên đăng nhập thật theo từng thiết bị, để trang "Bảo mật tài khoản"
-- hiển thị đúng thiết bị đã đăng nhập và cho phép thu hồi (đăng xuất từ xa).
-- Mỗi JWT phát ra khi đăng nhập/đăng ký sẽ mang theo 1 "jti" (JWT ID) khớp với
-- 1 dòng trong bảng này. Khi jti bị revoked_at set, JwtStrategy sẽ từ chối JWT đó
-- ngay cả khi chữ ký/thời hạn JWT vẫn còn hợp lệ.

CREATE TABLE IF NOT EXISTS user_sessions (
    id              SERIAL PRIMARY KEY,
    jti             VARCHAR(64) NOT NULL UNIQUE,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_label    VARCHAR(255),
    browser         VARCHAR(100),
    os              VARCHAR(100),
    ip_address      VARCHAR(64),
    user_agent      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti);
