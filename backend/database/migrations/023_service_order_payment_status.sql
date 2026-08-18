-- 023_service_order_payment_status.sql
-- Bổ sung trạng thái thanh toán THẬT cho đơn dịch vụ (trước đây chỉ demo ở
-- localStorage của trình duyệt, không lưu server -> không đồng bộ giữa
-- khách hàng và admin, mất khi đổi máy/trình duyệt).
--
-- Luồng mới:
--   1) Khách hàng bấm "Tôi đã thanh toán" (khi đơn ở trạng thái 'confirmed')
--      -> payment_status = 'awaiting_confirmation', paid_at = NOW()
--      -> Hiển thị: "Đã thanh toán - đang chờ duyệt"
--   2) Admin bấm "Xác nhận đã nhận thanh toán"
--      -> payment_status = 'paid', payment_confirmed_at = NOW()
--      -> Đơn tự động chuyển status 'confirmed' -> 'in_progress'
--      -> Hiển thị: "Đã thanh toán - đang thực hiện"
-- Idempotent: chạy nhiều lần vẫn an toàn.

BEGIN;

ALTER TABLE service_orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30)
        NOT NULL DEFAULT 'unpaid',

    ADD COLUMN IF NOT EXISTS payment_code           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS paid_at                TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_confirmed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_confirmed_by   INT REFERENCES users(user_id);

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_payment_status_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'awaiting_confirmation', 'paid'));

CREATE INDEX IF NOT EXISTS idx_so_payment_status ON service_orders(payment_status);

COMMIT;
