-- 013_add_service_order_rework.sql
-- Bổ sung tính năng "Đánh giá dịch vụ" và "Yêu cầu làm lại" cho đơn dịch vụ
-- đã hoàn thành (FR-06/FR-07/FR-11):
--   - Khách hàng có thể đánh giá (sao + nhận xét) đơn đã completed.
--   - Khách hàng có thể gửi yêu cầu làm lại nếu chưa hài lòng -> đơn chuyển
--     sang trạng thái mới 'rework_requested'.
--   - Admin duyệt (approve -> in_progress) hoặc từ chối (reject -> completed,
--     kèm phản hồi) yêu cầu làm lại.
-- Idempotent: chạy nhiều lần vẫn an toàn.

BEGIN;

-- 1) Mở rộng danh sách trạng thái hợp lệ của service_orders.status
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
    CHECK (status IN (
        'submitted',
        'pending_confirm',
        'confirmed',
        'in_progress',
        'completed',
        'rework_requested',
        'cancelled'
    ));

-- 2) Cột lưu đánh giá của khách hàng
ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS feedback_rating   SMALLINT
        CHECK (feedback_rating BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS feedback_comment  TEXT,
    ADD COLUMN IF NOT EXISTS feedback_at       TIMESTAMPTZ;

-- 3) Cột lưu yêu cầu làm lại và quyết định của admin
ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS rework_status         VARCHAR(20)
        NOT NULL DEFAULT 'none'
        CHECK (rework_status IN ('none', 'pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS rework_reason          TEXT,
    ADD COLUMN IF NOT EXISTS rework_requested_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rework_admin_response  TEXT,
    ADD COLUMN IF NOT EXISTS rework_decided_at      TIMESTAMPTZ;

COMMIT;
