-- 002_add_service_order_history.sql
-- Bổ sung bảng service_order_history cho các database bị thiếu bảng này
-- (được định nghĩa trong DBase.sql nhưng chưa tồn tại ở DB thật, gây lỗi
-- "relation "service_order_history" does not exist" khi khách hàng đặt dịch vụ).
-- Idempotent: chạy nhiều lần vẫn an toàn, không mất dữ liệu hiện có.

CREATE TABLE IF NOT EXISTS service_order_history (
    history_id         SERIAL          PRIMARY KEY,
    order_id            INT             NOT NULL REFERENCES service_orders(order_id) ON DELETE CASCADE,
    changed_by          INT             REFERENCES users(user_id),
    action               VARCHAR(50)     NOT NULL,
    previous_status      VARCHAR(30),
    new_status           VARCHAR(30),
    assigned_to          INT             REFERENCES users(user_id),
    note                 TEXT,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soh_order_created
    ON service_order_history(order_id, created_at DESC);