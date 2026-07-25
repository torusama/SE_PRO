-- Hoàn thiện quy trình quản lý đơn dịch vụ phía admin.
-- Migration additive/idempotent; không thay đổi hoặc xoá dữ liệu đơn hiện có.

CREATE TABLE IF NOT EXISTS service_order_history (
    history_id         SERIAL          PRIMARY KEY,
    order_id           INT             NOT NULL
                       REFERENCES service_orders(order_id) ON DELETE CASCADE,
    changed_by         INT             REFERENCES users(user_id),
    action             VARCHAR(50)     NOT NULL,
    previous_status    VARCHAR(30),
    new_status         VARCHAR(30),
    assigned_to        INT             REFERENCES users(user_id),
    note               TEXT,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soh_order_created
    ON service_order_history(order_id, created_at DESC);

-- Tạo mốc lịch sử ban đầu cho các đơn đã tồn tại trước migration.
INSERT INTO service_order_history (
    order_id,
    changed_by,
    action,
    previous_status,
    new_status,
    assigned_to,
    note,
    created_at
)
SELECT
    so.order_id,
    so.user_id,
    'submitted',
    NULL,
    so.status,
    so.assigned_to,
    so.note,
    so.created_at
FROM service_orders so
WHERE NOT EXISTS (
    SELECT 1
    FROM service_order_history history
    WHERE history.order_id = so.order_id
);
