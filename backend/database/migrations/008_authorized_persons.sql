-- "Người thân được ủy quyền": áp dụng theo TÀI KHOẢN (không theo từng lô), vì
-- panel này hiển thị ở màn hình tổng quan "Lô đất của tôi", không phải trong
-- chi tiết 1 lô cụ thể. Không tự tạo dòng nào khi hồ sơ có emergency contact —
-- frontend chỉ dùng dữ liệu đó để GỢI Ý điền sẵn form thêm mới, người dùng vẫn
-- phải bấm Lưu để thực sự tạo bản ghi.

CREATE TABLE IF NOT EXISTS user_authorized_persons (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name   VARCHAR(150) NOT NULL,
    relation    VARCHAR(50),
    phone       VARCHAR(20),
    email       VARCHAR(255),
    permission  VARCHAR(30) NOT NULL DEFAULT 'view'
                CHECK (permission IN ('view', 'view_and_service')),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authorized_persons_user ON user_authorized_persons(user_id);
