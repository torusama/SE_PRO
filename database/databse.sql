-- ================================================================
-- CEMETERY MANAGEMENT SYSTEM — PostgreSQL Schema (Hoàn chỉnh 100%)
-- Dự án: Hệ thống Quản lý Nghĩa trang — Nhóm 8
-- Phiên bản: 2.0 (Final)
-- Phủ sóng: FR-01 → FR-14 đầy đủ
-- ================================================================
-- Thứ tự tạo bảng (phụ thuộc FK):
--   1.  users
--   2.  cemetery_zones
--   3.  plots
--   4.  reservation_requests
--   5.  request_plots
--   6.  contracts
--   7.  payment_transactions
--   8.  ownership_records
--   9.  transfer_requests
--   10. service_types
--   11. service_orders
--   12. notifications
--   13. reminders
--   14. ai_recommendation_logs
--   15. audit_logs
-- ================================================================

-- ----------------------------------------------------------------
-- 0. SETUP
-- ----------------------------------------------------------------
SET client_encoding = 'UTF8';

-- ================================================================
-- 1. USERS (FR-01)
-- ================================================================
CREATE TABLE users (
    user_id         SERIAL          PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'Customer'
                    CHECK (role IN ('Admin', 'Customer')),
    full_name       VARCHAR(100)    NOT NULL,
    phone_number    VARCHAR(20),
    address         TEXT,
    id_card_number  VARCHAR(20),        -- CCCD / CMND
    date_of_birth   DATE,
    gender          VARCHAR(10)     CHECK (gender IN ('male', 'female', 'other')),
    avatar_url      TEXT,               -- Firebase Storage URL
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,  -- soft delete
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_active   ON users(is_active, is_deleted);

-- ================================================================
-- 2. CEMETERY ZONES (FR-02, FR-10)
-- ================================================================
CREATE TABLE cemetery_zones (
    zone_id         SERIAL          PRIMARY KEY,
    zone_code       VARCHAR(20)     NOT NULL UNIQUE,    -- A, B, C, D
    zone_name       VARCHAR(100)    NOT NULL,
    description     TEXT,
    -- Tọa độ khung bao zone trên bản đồ 2D (để frontend vẽ nền)
    map_x           FLOAT,
    map_y           FLOAT,
    map_width       FLOAT,
    map_height      FLOAT,
    color_hex       VARCHAR(7),     -- Màu nền zone VD: #FFE4B5
    sort_order      INT             NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 3. PLOTS (FR-02, FR-10)
-- ================================================================
CREATE TABLE plots (
    plot_id         SERIAL          PRIMARY KEY,
    plot_code       VARCHAR(50)     NOT NULL UNIQUE,    -- A-01-001
    zone_id         INT             NOT NULL REFERENCES cemetery_zones(zone_id),
    row_number      VARCHAR(10),            -- Hàng
    column_number   VARCHAR(10),            -- Cột / số thứ tự

    -- Tọa độ render bản đồ 2D (FR-02)
    map_x           FLOAT           NOT NULL DEFAULT 0,
    map_y           FLOAT           NOT NULL DEFAULT 0,
    map_width       FLOAT           NOT NULL DEFAULT 40,
    map_height      FLOAT           NOT NULL DEFAULT 40,

    -- Thông tin lô
    area_sqm        DECIMAL(10,2),
    price           DECIMAL(15,2)   NOT NULL,
    direction       VARCHAR(20),            -- Nam, Bắc, Đông, Tây
    plot_type       VARCHAR(20)     NOT NULL DEFAULT 'single'
                    CHECK (plot_type IN ('single', 'double', 'family')),
    description     TEXT,
    image_url       TEXT,                   -- Firebase Storage URL

    -- Trạng thái
    status          VARCHAR(20)     NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'pending', 'reserved', 'sold', 'locked')),

    -- Lock tạm thời khi đang pending (chống race condition FR-03)
    reserved_until  TIMESTAMPTZ,            -- NULL = không lock

    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    last_updated    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plots_zone     ON plots(zone_id);
CREATE INDEX idx_plots_status   ON plots(status);
CREATE INDEX idx_plots_code     ON plots(plot_code);

-- ================================================================
-- 4. RESERVATION REQUESTS (FR-03, FR-04)
-- ================================================================
CREATE TABLE reservation_requests (
    request_id          SERIAL          PRIMARY KEY,
    user_id             INT             NOT NULL REFERENCES users(user_id),
    request_type        VARCHAR(20)     NOT NULL DEFAULT 'purchase'
                        CHECK (request_type IN ('reserve', 'purchase')),
    status              VARCHAR(20)     NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'cancelled')),

    -- Thông tin người yêu cầu (có thể đặt hộ người khác)
    requester_name      VARCHAR(100),
    requester_phone     VARCHAR(20),
    requester_id_card   VARCHAR(20),
    requester_address   TEXT,

    -- Thông tin người được mai táng (điền khi đặt hoặc sau)
    deceased_name       VARCHAR(100),
    deceased_dob        DATE,
    deceased_dod        DATE,
    deceased_gender     VARCHAR(10)     CHECK (deceased_gender IN ('male', 'female', 'other')),

    -- Tổng tiền (tính khi submit)
    total_price         DECIMAL(15,2),

    -- Ghi chú & tài liệu đính kèm
    note                TEXT,
    document_urls       TEXT[],         -- Firebase Storage URLs (CCCD, giấy tờ...)

    -- Admin xử lý
    admin_id            INT             REFERENCES users(user_id),
    admin_note          TEXT,
    reviewed_at         TIMESTAMPTZ,

    -- Nguồn tạo
    is_ai_draft         BOOLEAN         NOT NULL DEFAULT FALSE,  -- FR-14

    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rr_user        ON reservation_requests(user_id);
CREATE INDEX idx_rr_status      ON reservation_requests(status);
CREATE INDEX idx_rr_admin       ON reservation_requests(admin_id);

-- ----------------------------------------------------------------
-- 4b. REQUEST_PLOTS — nhiều lô cho 1 request (FR-04)
-- ----------------------------------------------------------------
CREATE TABLE request_plots (
    id              SERIAL          PRIMARY KEY,
    request_id      INT             NOT NULL REFERENCES reservation_requests(request_id) ON DELETE CASCADE,
    plot_id         INT             NOT NULL REFERENCES plots(plot_id),
    plot_price      DECIMAL(15,2)   NOT NULL,   -- Giá tại thời điểm đặt
    UNIQUE (request_id, plot_id)
);

CREATE INDEX idx_rp_request     ON request_plots(request_id);
CREATE INDEX idx_rp_plot        ON request_plots(plot_id);

-- ================================================================
-- 5. CONTRACTS (FR-12)
-- ================================================================
CREATE TABLE contracts (
    contract_id         SERIAL          PRIMARY KEY,
    contract_code       VARCHAR(50)     NOT NULL UNIQUE,    -- HD-2026-0001
    request_id          INT             REFERENCES reservation_requests(request_id),
    user_id             INT             NOT NULL REFERENCES users(user_id),
    plot_id             INT             NOT NULL REFERENCES plots(plot_id),

    -- Thời hạn hợp đồng
    contract_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_date      DATE,
    expiry_date         DATE,

    -- Tài chính
    total_amount        DECIMAL(15,2)   NOT NULL,
    paid_amount         DECIMAL(15,2)   NOT NULL DEFAULT 0,
    payment_method      VARCHAR(30)     CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
    payment_status      VARCHAR(20)     NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    payment_date        DATE,           -- Ngày thanh toán đủ

    -- Trạng thái hợp đồng
    status              VARCHAR(20)     NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'expired', 'transferred', 'cancelled')),

    -- File PDF
    pdf_url             TEXT,           -- Firebase Storage URL

    -- Admin tạo
    created_by          INT             REFERENCES users(user_id),
    notes               TEXT,

    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_user     ON contracts(user_id);
CREATE INDEX idx_contracts_plot     ON contracts(plot_id);
CREATE INDEX idx_contracts_status   ON contracts(status);
CREATE INDEX idx_contracts_code     ON contracts(contract_code);

-- ================================================================
-- 6. PAYMENT TRANSACTIONS (FR-12 — hỗ trợ thanh toán nhiều đợt)
-- ================================================================
CREATE TABLE payment_transactions (
    transaction_id      SERIAL          PRIMARY KEY,
    contract_id         INT             NOT NULL REFERENCES contracts(contract_id),
    amount              DECIMAL(15,2)   NOT NULL,
    payment_method      VARCHAR(30)     NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
    payment_date        DATE            NOT NULL DEFAULT CURRENT_DATE,
    reference_code      VARCHAR(100),   -- Mã giao dịch ngân hàng
    note                TEXT,
    recorded_by         INT             REFERENCES users(user_id),  -- Admin ghi nhận
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_contract   ON payment_transactions(contract_id);

-- ================================================================
-- 7. OWNERSHIP RECORDS (FR-12, FR-05)
-- ================================================================
CREATE TABLE ownership_records (
    ownership_id        SERIAL          PRIMARY KEY,
    contract_id         INT             NOT NULL REFERENCES contracts(contract_id),
    plot_id             INT             NOT NULL REFERENCES plots(plot_id),
    user_id             INT             NOT NULL REFERENCES users(user_id),

    -- Người được an táng
    deceased_name       VARCHAR(100),
    deceased_dob        DATE,
    deceased_dod        DATE,
    deceased_gender     VARCHAR(10)     CHECK (deceased_gender IN ('male', 'female', 'other')),
    burial_date         DATE,

    -- Thời gian sở hữu
    ownership_start     DATE            NOT NULL DEFAULT CURRENT_DATE,
    ownership_end       DATE,
    is_current          BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Nguồn tạo record
    source              VARCHAR(20)     NOT NULL DEFAULT 'purchase'
                        CHECK (source IN ('purchase', 'transfer', 'inheritance')),
    transfer_note       TEXT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_own_plot       ON ownership_records(plot_id);
CREATE INDEX idx_own_user       ON ownership_records(user_id);
CREATE INDEX idx_own_current    ON ownership_records(plot_id, is_current);

-- ================================================================
-- 8. TRANSFER / INHERITANCE REQUESTS (FR-05)
-- ================================================================
CREATE TABLE transfer_requests (
    transfer_id             SERIAL          PRIMARY KEY,
    request_type            VARCHAR(20)     NOT NULL
                            CHECK (request_type IN ('transfer', 'inheritance')),

    -- Chủ sở hữu hiện tại
    current_owner_id        INT             NOT NULL REFERENCES users(user_id),
    contract_id             INT             NOT NULL REFERENCES contracts(contract_id),
    plot_id                 INT             NOT NULL REFERENCES plots(plot_id),

    -- Người nhận
    recipient_name          VARCHAR(100)    NOT NULL,
    recipient_phone         VARCHAR(20),
    recipient_id_card       VARCHAR(20),
    recipient_email         VARCHAR(255),
    recipient_address       TEXT,
    recipient_dob           DATE,

    -- Lý do & tài liệu
    reason                  TEXT,
    document_urls           TEXT[],         -- Firebase Storage URLs

    -- Xử lý
    status                  VARCHAR(20)     NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted', 'pending', 'approved', 'rejected', 'cancelled')),
    admin_id                INT             REFERENCES users(user_id),
    admin_note              TEXT,
    reviewed_at             TIMESTAMPTZ,

    -- Kết quả sau approve
    new_ownership_id        INT             REFERENCES ownership_records(ownership_id),
    new_contract_id         INT             REFERENCES contracts(contract_id),

    is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tr_owner       ON transfer_requests(current_owner_id);
CREATE INDEX idx_tr_plot        ON transfer_requests(plot_id);
CREATE INDEX idx_tr_status      ON transfer_requests(status);

-- ================================================================
-- 9. SERVICE TYPES (FR-06, FR-11)
-- ================================================================
CREATE TABLE service_types (
    service_type_id     SERIAL          PRIMARY KEY,
    name                VARCHAR(100)    NOT NULL,
    description         TEXT,
    base_price          DECIMAL(15,2)   NOT NULL DEFAULT 0,
    unit                VARCHAR(30)     NOT NULL DEFAULT 'lần',  -- lần, tháng, buổi, bộ
    category            VARCHAR(20)     NOT NULL DEFAULT 'other'
                        CHECK (category IN ('burial', 'maintenance', 'memorial', 'other')),
    image_url           TEXT,
    sort_order          INT             NOT NULL DEFAULT 0,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 10. SERVICE ORDERS (FR-06, FR-07, FR-11)
-- ================================================================
CREATE TABLE service_orders (
    order_id                SERIAL          PRIMARY KEY,
    user_id                 INT             NOT NULL REFERENCES users(user_id),
    plot_id                 INT             REFERENCES plots(plot_id),
    service_type_id         INT             NOT NULL REFERENCES service_types(service_type_id),

    -- Chi tiết đơn hàng
    quantity                INT             NOT NULL DEFAULT 1,
    unit_price              DECIMAL(15,2)   NOT NULL,   -- Giá tại thời điểm đặt
    amount                  DECIMAL(15,2)   NOT NULL,   -- = quantity × unit_price

    -- Lịch thực hiện
    requested_date          DATE,           -- Khách muốn
    scheduled_date          DATE,           -- Admin lên lịch
    note                    TEXT,

    -- Trạng thái
    status                  VARCHAR(30)     NOT NULL DEFAULT 'submitted'
                            CHECK (status IN (
                                'submitted',
                                'pending_confirm',
                                'confirmed',
                                'in_progress',
                                'completed',
                                'cancelled'
                            )),

    -- Hoàn thành (FR-07)
    completion_note         TEXT,
    completion_image_urls   TEXT[],         -- Firebase Storage URLs
    completed_at            TIMESTAMPTZ,

    -- Admin xử lý
    admin_id                INT             REFERENCES users(user_id),
    admin_note              TEXT,

    is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_so_user        ON service_orders(user_id);
CREATE INDEX idx_so_plot        ON service_orders(plot_id);
CREATE INDEX idx_so_status      ON service_orders(status);
CREATE INDEX idx_so_type        ON service_orders(service_type_id);

-- ================================================================
-- 11. NOTIFICATIONS (FR-09)
-- ================================================================
CREATE TABLE notifications (
    notification_id         SERIAL          PRIMARY KEY,
    user_id                 INT             NOT NULL REFERENCES users(user_id),

    -- Loại thông báo
    type                    VARCHAR(50)     NOT NULL,
    -- Các type hợp lệ (comment để backend biết):
    -- request_submitted | request_approved | request_rejected | request_cancelled
    -- contract_created | contract_updated | contract_pdf_ready
    -- service_submitted | service_confirmed | service_in_progress | service_completed | service_cancelled
    -- transfer_submitted | transfer_approved | transfer_rejected
    -- memorial_reminder | system_update

    title                   VARCHAR(255)    NOT NULL,
    message                 TEXT            NOT NULL,

    -- Liên kết entity
    related_entity_type     VARCHAR(50),    -- 'reservation_request' | 'contract' | 'service_order' | 'transfer_request' | 'reminder'
    related_entity_id       INT,

    -- Kênh gửi
    channel                 VARCHAR(20)     NOT NULL DEFAULT 'in_app'
                            CHECK (channel IN ('in_app', 'email', 'both')),
    is_email_sent           BOOLEAN         NOT NULL DEFAULT FALSE,
    email_sent_at           TIMESTAMPTZ,

    is_read                 BOOLEAN         NOT NULL DEFAULT FALSE,
    read_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user         ON notifications(user_id);
CREATE INDEX idx_notif_unread       ON notifications(user_id, is_read);
CREATE INDEX idx_notif_type         ON notifications(type);
CREATE INDEX idx_notif_entity       ON notifications(related_entity_type, related_entity_id);

-- ================================================================
-- 12. REMINDERS — Nhắc lịch ngày giỗ / tưởng niệm (FR-08)
-- ================================================================
CREATE TABLE reminders (
    reminder_id         SERIAL          PRIMARY KEY,
    user_id             INT             NOT NULL REFERENCES users(user_id),
    plot_id             INT             REFERENCES plots(plot_id),
    ownership_id        INT             REFERENCES ownership_records(ownership_id),

    title               VARCHAR(255)    NOT NULL,   -- "Ngày giỗ của Nguyễn Văn A"
    description         TEXT,

    -- Dương lịch: lưu tháng + ngày riêng để cron so sánh hàng năm
    remind_month        SMALLINT        NOT NULL CHECK (remind_month BETWEEN 1 AND 12),
    remind_day          SMALLINT        NOT NULL CHECK (remind_day   BETWEEN 1 AND 31),
    -- Âm lịch (tham khảo, không bắt buộc)
    lunar_month         SMALLINT        CHECK (lunar_month BETWEEN 1 AND 12),
    lunar_day           SMALLINT        CHECK (lunar_day   BETWEEN 1 AND 30),

    -- Ngày cụ thể (cho nhắc 1 lần, không lặp)
    specific_date       DATE,

    reminder_type       VARCHAR(20)     NOT NULL DEFAULT 'death_anniversary'
                        CHECK (reminder_type IN ('death_anniversary', 'memorial', 'maintenance', 'other')),
    is_recurring        BOOLEAN         NOT NULL DEFAULT TRUE,  -- Hàng năm?
    notify_days_before  INT             NOT NULL DEFAULT 3,     -- Nhắc trước bao nhiêu ngày

    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    last_sent_at        TIMESTAMPTZ,    -- Lần cuối cron đã gửi
    last_sent_year      INT,            -- Năm đã gửi (tránh gửi 2 lần / năm)

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rem_user           ON reminders(user_id);
CREATE INDEX idx_rem_month_day      ON reminders(remind_month, remind_day);
CREATE INDEX idx_rem_active         ON reminders(is_active, is_deleted);

-- ================================================================
-- 13. AI RECOMMENDATION LOGS (FR-14)
-- ================================================================
CREATE TABLE ai_recommendation_logs (
    log_id                  SERIAL          PRIMARY KEY,
    user_id                 INT             REFERENCES users(user_id),
    session_id              VARCHAR(100)    NOT NULL,       -- ID phiên chatbot

    -- Version model/logic AI
    model_version           VARCHAR(50)     NOT NULL DEFAULT 'v1.0',

    -- Input từ khách hàng (thu thập qua chatbot)
    budget_min              DECIMAL(15,2),
    budget_max              DECIMAL(15,2),
    num_plots_needed        INT,
    preferred_zone_id       INT             REFERENCES cemetery_zones(zone_id),
    preferred_direction     VARCHAR(20),
    family_size             INT,
    plot_type_preference    VARCHAR(20),
    special_requirements    TEXT,
    bazi_info               TEXT,           -- Bát tự (tham khảo tâm linh)

    -- Output AI
    recommended_plot_ids    INT[],          -- Danh sách plot_id được gợi ý
    recommendation_note     TEXT,           -- Giải thích lý do gợi ý
    estimated_total         DECIMAL(15,2),

    -- Hành động agentic
    draft_request_id        INT             REFERENCES reservation_requests(request_id),
    map_highlight_sent      BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Toàn bộ lịch sử chat (JSONB để query linh hoạt)
    conversation_log        JSONB,

    -- Phản hồi người dùng
    user_rating             SMALLINT        CHECK (user_rating BETWEEN 1 AND 5),
    user_feedback           TEXT,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_user        ON ai_recommendation_logs(user_id);
CREATE INDEX idx_ai_session     ON ai_recommendation_logs(session_id);
CREATE INDEX idx_ai_version     ON ai_recommendation_logs(model_version);

-- ================================================================
-- 14. AUDIT LOGS (FR-13 — lịch sử thao tác)
-- ================================================================
CREATE TABLE audit_logs (
    log_id          SERIAL          PRIMARY KEY,
    user_id         INT             REFERENCES users(user_id),
    action          VARCHAR(100)    NOT NULL,
    -- VD: plot_status_changed, contract_created, request_approved,
    --     ownership_transferred, service_completed, user_login...
    entity_type     VARCHAR(50),
    entity_id       INT,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user         ON audit_logs(user_id);
CREATE INDEX idx_audit_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action       ON audit_logs(action);
CREATE INDEX idx_audit_created      ON audit_logs(created_at DESC);

-- ================================================================
-- 15. FUNCTIONS & TRIGGERS
-- ================================================================

-- Hàm cập nhật updated_at tự động
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger updated_at cho tất cả bảng cần thiết
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_plots_updated_at
    BEFORE UPDATE ON plots
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_rr_updated_at
    BEFORE UPDATE ON reservation_requests
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_so_updated_at
    BEFORE UPDATE ON service_orders
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_st_updated_at
    BEFORE UPDATE ON service_types
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_tr_updated_at
    BEFORE UPDATE ON transfer_requests
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_rem_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ----------------------------------------------------------------
-- Trigger: Khi contract được tạo → tự động tạo ownership_record
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auto_create_ownership()
RETURNS TRIGGER AS $$
BEGIN
    -- Chỉ tạo khi contract mới được insert và có status = active
    IF (TG_OP = 'INSERT' AND NEW.status = 'active') THEN
        INSERT INTO ownership_records (
            contract_id,
            plot_id,
            user_id,
            ownership_start,
            is_current,
            source
        ) VALUES (
            NEW.contract_id,
            NEW.plot_id,
            NEW.user_id,
            NEW.contract_date,
            TRUE,
            'purchase'
        );

        -- Cập nhật trạng thái lô đất → sold
        UPDATE plots
        SET status = 'sold',
            reserved_until = NULL
        WHERE plot_id = NEW.plot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_create_ownership
    AFTER INSERT ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_auto_create_ownership();

-- ----------------------------------------------------------------
-- Trigger: Khi paid_amount thay đổi → tự cập nhật payment_status
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.paid_amount >= NEW.total_amount THEN
        NEW.payment_status = 'paid';
        NEW.payment_date   = CURRENT_DATE;
    ELSIF NEW.paid_amount > 0 THEN
        NEW.payment_status = 'partial';
    ELSE
        NEW.payment_status = 'unpaid';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_payment_status
    BEFORE UPDATE OF paid_amount ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_update_payment_status();

-- ----------------------------------------------------------------
-- Trigger: Khi payment_transaction được thêm → cộng vào paid_amount của contract
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_accum_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contracts
    SET paid_amount = paid_amount + NEW.amount
    WHERE contract_id = NEW.contract_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_accum
    AFTER INSERT ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_accum_payment();

-- ----------------------------------------------------------------
-- Trigger: Khi plots.status thay đổi → cập nhật last_updated
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_plot_status_updated()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.last_updated = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plot_status_change
    BEFORE UPDATE OF status ON plots
    FOR EACH ROW EXECUTE FUNCTION fn_plot_status_updated();

-- ----------------------------------------------------------------
-- Hàm release lô đất hết hạn reserved_until (gọi từ cron job)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_release_expired_reservations()
RETURNS INT AS $$
DECLARE
    released INT;
BEGIN
    UPDATE plots
    SET status         = 'available',
        reserved_until = NULL
    WHERE status       = 'pending'
      AND reserved_until < NOW();

    GET DIAGNOSTICS released = ROW_COUNT;
    RETURN released;
END;
$$ LANGUAGE plpgsql;
-- Dùng: SELECT fn_release_expired_reservations();

-- ================================================================
-- 16. VIEWS HỖ TRỢ DASHBOARD & API (FR-13, FR-02)
-- ================================================================

-- Bản đồ 2D đầy đủ thông tin (FR-02)
CREATE OR REPLACE VIEW vw_plots_map AS
SELECT
    p.plot_id,
    p.plot_code,
    p.zone_id,
    cz.zone_code,
    cz.zone_name,
    cz.color_hex        AS zone_color,
    p.row_number,
    p.column_number,
    p.map_x,
    p.map_y,
    p.map_width,
    p.map_height,
    p.area_sqm,
    p.price,
    p.direction,
    p.plot_type,
    p.description,
    p.image_url,
    p.status,
    p.reserved_until,
    -- Chủ sở hữu hiện tại
    own.user_id         AS owner_id,
    u.full_name         AS owner_name,
    u.phone_number      AS owner_phone,
    own.deceased_name,
    own.burial_date
FROM  plots p
JOIN  cemetery_zones cz  ON p.zone_id    = cz.zone_id
LEFT  JOIN ownership_records own
                          ON p.plot_id   = own.plot_id
                         AND own.is_current = TRUE
LEFT  JOIN users u        ON own.user_id = u.user_id
WHERE p.is_deleted = FALSE;

-- Thống kê lô đất (FR-13)
CREATE OR REPLACE VIEW vw_plot_statistics AS
SELECT
    cz.zone_code,
    cz.zone_name,
    p.status,
    COUNT(*)            AS total_plots,
    SUM(p.price)        AS total_value,
    SUM(p.area_sqm)     AS total_area
FROM  plots p
JOIN  cemetery_zones cz ON p.zone_id = cz.zone_id
WHERE p.is_deleted = FALSE
GROUP BY cz.zone_code, cz.zone_name, p.status
ORDER BY cz.zone_code, p.status;

-- Doanh thu theo tháng (FR-13)
CREATE OR REPLACE VIEW vw_revenue_by_month AS
SELECT
    DATE_TRUNC('month', c.contract_date)   AS month,
    COUNT(*)                                AS total_contracts,
    SUM(c.total_amount)                     AS expected_revenue,
    SUM(c.paid_amount)                      AS collected_revenue,
    SUM(c.total_amount - c.paid_amount)     AS outstanding
FROM  contracts c
WHERE c.status     = 'active'
  AND c.is_deleted = FALSE
GROUP BY DATE_TRUNC('month', c.contract_date)
ORDER BY month DESC;

-- Thống kê dịch vụ (FR-13)
CREATE OR REPLACE VIEW vw_service_statistics AS
SELECT
    st.service_type_id,
    st.name             AS service_name,
    st.category,
    COUNT(so.order_id)  AS total_orders,
    SUM(so.amount)      AS total_revenue,
    COUNT(CASE WHEN so.status = 'completed'                                             THEN 1 END) AS completed,
    COUNT(CASE WHEN so.status IN ('submitted','pending_confirm','confirmed','in_progress') THEN 1 END) AS active,
    COUNT(CASE WHEN so.status = 'cancelled'                                             THEN 1 END) AS cancelled
FROM  service_types st
LEFT  JOIN service_orders so ON st.service_type_id = so.service_type_id
                             AND so.is_deleted = FALSE
WHERE st.is_deleted = FALSE
GROUP BY st.service_type_id, st.name, st.category;

-- Tổng quan dashboard admin (FR-13)
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM plots          WHERE is_deleted = FALSE)                  AS total_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'available' AND is_deleted = FALSE) AS available_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'pending'   AND is_deleted = FALSE) AS pending_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'reserved'  AND is_deleted = FALSE) AS reserved_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'sold'      AND is_deleted = FALSE) AS sold_plots,
    (SELECT COUNT(*) FROM users          WHERE role = 'Customer'    AND is_deleted = FALSE) AS total_customers,
    (SELECT COUNT(*) FROM reservation_requests WHERE status = 'submitted' AND is_deleted = FALSE) AS pending_requests,
    (SELECT COUNT(*) FROM service_orders WHERE status IN ('submitted','pending_confirm','confirmed','in_progress') AND is_deleted = FALSE) AS active_services,
    (SELECT COUNT(*) FROM contracts      WHERE status = 'active'    AND is_deleted = FALSE) AS active_contracts,
    (SELECT COALESCE(SUM(paid_amount),0) FROM contracts WHERE status = 'active' AND is_deleted = FALSE) AS total_collected;

-- Danh sách yêu cầu đặt lô đầy đủ (API admin)
CREATE OR REPLACE VIEW vw_reservation_requests_full AS
SELECT
    rr.request_id,
    rr.request_type,
    rr.status,
    rr.requester_name,
    rr.requester_phone,
    rr.requester_id_card,
    rr.deceased_name,
    rr.total_price,
    rr.note,
    rr.is_ai_draft,
    rr.created_at,
    rr.reviewed_at,
    -- User
    u.user_id,
    u.full_name         AS customer_name,
    u.email             AS customer_email,
    u.phone_number      AS customer_phone,
    -- Admin
    adm.full_name       AS admin_name,
    rr.admin_note,
    -- Danh sách lô (aggregate)
    ARRAY_AGG(p.plot_code ORDER BY p.plot_code) AS plot_codes,
    COUNT(rp.plot_id)   AS plot_count
FROM  reservation_requests rr
JOIN  users u           ON rr.user_id   = u.user_id
LEFT  JOIN users adm    ON rr.admin_id  = adm.user_id
LEFT  JOIN request_plots rp ON rr.request_id = rp.request_id
LEFT  JOIN plots p      ON rp.plot_id   = p.plot_id
WHERE rr.is_deleted = FALSE
GROUP BY
    rr.request_id, rr.request_type, rr.status, rr.requester_name,
    rr.requester_phone, rr.requester_id_card, rr.deceased_name,
    rr.total_price, rr.note, rr.is_ai_draft, rr.created_at, rr.reviewed_at,
    u.user_id, u.full_name, u.email, u.phone_number,
    adm.full_name, rr.admin_note;

-- ================================================================
-- 17. SEED DATA
-- ================================================================

-- Users (password hash là placeholder — backend sẽ hash bằng bcrypt)
INSERT INTO users (email, password_hash, role, full_name, phone_number, address, id_card_number, date_of_birth, gender) VALUES
('admin@cemetery.vn',        '$2b$10$PLACEHOLDER_ADMIN_HASH',   'Admin',    'Quản trị viên Hệ thống',  '0901234567', 'TP. Hồ Chí Minh',  '079200001111', '1985-03-15', 'male'),
('admin2@cemetery.vn',       '$2b$10$PLACEHOLDER_ADMIN2_HASH',  'Admin',    'Phó Quản trị viên',       '0901234568', 'TP. Hồ Chí Minh',  '079200002222', '1990-07-20', 'female'),
('khachhang1@gmail.com',     '$2b$10$PLACEHOLDER_USER1_HASH',   'Customer', 'Nguyễn Văn An',           '0987654321', 'Quận 1, TP.HCM',   '079300001111', '1975-05-10', 'male'),
('khachhang2@gmail.com',     '$2b$10$PLACEHOLDER_USER2_HASH',   'Customer', 'Trần Thị Bình',           '0912345678', 'Quận 3, TP.HCM',   '079300002222', '1980-09-22', 'female'),
('khachhang3@gmail.com',     '$2b$10$PLACEHOLDER_USER3_HASH',   'Customer', 'Lê Văn Cường',            '0933445566', 'Quận 7, TP.HCM',   '079300003333', '1968-12-01', 'male'),
('khachhang4@gmail.com',     '$2b$10$PLACEHOLDER_USER4_HASH',   'Customer', 'Phạm Thị Dung',           '0944556677', 'Bình Dương',        '079300004444', '1955-03-30', 'female');

-- Cemetery Zones
INSERT INTO cemetery_zones (zone_code, zone_name, description, map_x, map_y, map_width, map_height, color_hex, sort_order) VALUES
('A', 'Khu A — Cao Cấp',    'Khu vực cao cấp, phong thủy tốt, gần cổng chính', 0,   0,   300, 250, '#FFF3CD', 1),
('B', 'Khu B — Tiêu Chuẩn', 'Khu vực tiêu chuẩn, diện tích vừa phải',          310, 0,   300, 250, '#D1ECF1', 2),
('C', 'Khu C — Gia Đình',   'Khu vực dành cho nhóm lô gia đình hoặc dòng họ',  0,   260, 300, 300, '#D4EDDA', 3),
('D', 'Khu D — Bình Dân',   'Khu vực giá phổ thông',                            310, 260, 300, 300, '#F8D7DA', 4);

-- Plots — Khu A (10 lô đơn + 2 lô đôi)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('A-01-001', 1, '01', '001',  10,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-01-002', 1, '01', '002',  55,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-01-003', 1, '01', '003', 100,  10, 40, 40, 4.0,  52000000, 'Đông',  'single', 'sold'),
('A-01-004', 1, '01', '004', 145,  10, 40, 40, 4.0,  52000000, 'Đông',  'single', 'reserved'),
('A-01-005', 1, '01', '005', 190,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-02-001', 1, '02', '001',  10,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'available'),
('A-02-002', 1, '02', '002',  55,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'available'),
('A-02-003', 1, '02', '003', 100,  60, 40, 40, 4.0,  49000000, 'Tây',   'single', 'pending'),
('A-02-004', 1, '02', '004', 145,  60, 40, 40, 4.0,  49000000, 'Tây',   'single', 'available'),
('A-02-005', 1, '02', '005', 190,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'sold'),
('A-03-001', 1, '03', '001',  10, 110, 85, 40, 8.0,  95000000, 'Nam',   'double', 'available'),
('A-03-002', 1, '03', '002', 100, 110, 85, 40, 8.0,  95000000, 'Nam',   'double', 'locked');

-- Plots — Khu B (10 lô đơn)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('B-01-001', 2, '01', '001',  10,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-01-002', 2, '01', '002',  55,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-01-003', 2, '01', '003', 100,  10, 40, 40, 3.5, 31000000, 'Đông',  'single', 'sold'),
('B-01-004', 2, '01', '004', 145,  10, 40, 40, 3.5, 31000000, 'Đông',  'single', 'available'),
('B-01-005', 2, '01', '005', 190,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-02-001', 2, '02', '001',  10,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'available'),
('B-02-002', 2, '02', '002',  55,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'available'),
('B-02-003', 2, '02', '003', 100,  60, 40, 40, 3.5, 30000000, 'Bắc',   'single', 'available'),
('B-02-004', 2, '02', '004', 145,  60, 40, 40, 3.5, 30000000, 'Bắc',   'single', 'available'),
('B-02-005', 2, '02', '005', 190,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'sold');

-- Plots — Khu C (6 lô gia đình)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('C-01-001', 3, '01', '001',  10,  10, 80, 80, 12.0, 120000000, 'Nam',  'family', 'available'),
('C-01-002', 3, '01', '002', 100,  10, 80, 80, 12.0, 120000000, 'Nam',  'family', 'available'),
('C-01-003', 3, '01', '003', 190,  10, 80, 80, 12.0, 118000000, 'Đông', 'family', 'available'),
('C-02-001', 3, '02', '001',  10, 100, 80, 80, 12.0, 115000000, 'Đông', 'family', 'sold'),
('C-02-002', 3, '02', '002', 100, 100, 80, 80, 12.0, 115000000, 'Đông', 'family', 'available'),
('C-02-003', 3, '02', '003', 190, 100, 80, 80, 12.0, 113000000, 'Nam',  'family', 'available');

-- Plots — Khu D (8 lô bình dân)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('D-01-001', 4, '01', '001',  10,  10, 40, 40, 3.0, 20000000, 'Nam',   'single', 'available'),
('D-01-002', 4, '01', '002',  55,  10, 40, 40, 3.0, 20000000, 'Nam',   'single', 'available'),
('D-01-003', 4, '01', '003', 100,  10, 40, 40, 3.0, 21000000, 'Đông',  'single', 'available'),
('D-01-004', 4, '01', '004', 145,  10, 40, 40, 3.0, 21000000, 'Đông',  'single', 'sold'),
('D-02-001', 4, '02', '001',  10,  60, 40, 40, 3.0, 19000000, 'Nam',   'single', 'available'),
('D-02-002', 4, '02', '002',  55,  60, 40, 40, 3.0, 19000000, 'Nam',   'single', 'available'),
('D-02-003', 4, '02', '003', 100,  60, 40, 40, 3.0, 20000000, 'Bắc',   'single', 'available'),
('D-02-004', 4, '02', '004', 145,  60, 40, 40, 3.0, 20000000, 'Bắc',   'single', 'available');

-- Service Types
INSERT INTO service_types (name, description, base_price, unit, category, sort_order) VALUES
('Dịch vụ mai táng',        'Hỗ trợ toàn bộ quy trình mai táng tại nghĩa trang',    5000000,  'lần',   'burial',      1),
('Chăm sóc mộ định kỳ',     'Vệ sinh, chăm sóc mộ phần hàng tháng',                 500000,   'tháng', 'maintenance', 2),
('Dọn dẹp mộ',              'Làm cỏ, vệ sinh khu vực xung quanh mộ',                200000,   'lần',   'maintenance', 3),
('Thay hoa tươi',           'Thay hoa tươi theo yêu cầu',                            150000,   'lần',   'maintenance', 4),
('Thắp hương',              'Thắp hương tại mộ vào các ngày đặc biệt',              100000,   'lần',   'memorial',    5),
('Dịch vụ tưởng niệm',      'Tổ chức buổi lễ tưởng niệm tại mộ phần',              2000000,  'buổi',  'memorial',    6),
('Sơn sửa bia mộ',          'Sơn lại bia mộ và khu vực xung quanh',                1500000,  'lần',   'maintenance', 7),
('Chụp ảnh mộ phần',        'Ghi lại hình ảnh mộ phần và gửi về cho gia đình',      300000,   'lần',   'other',       8);

-- Reservation Request mẫu (status = approved → contract sẽ tạo riêng)
INSERT INTO reservation_requests
    (user_id, request_type, status, requester_name, requester_phone, requester_id_card,
     deceased_name, deceased_dob, deceased_dod, total_price, note, is_ai_draft)
VALUES
    (3, 'purchase', 'approved', 'Nguyễn Văn An', '0987654321', '079300001111',
     'Nguyễn Thị Mẹ', '1948-01-15', '2026-05-10', 52000000, 'Yêu cầu mua lô A-01-003', FALSE),
    (4, 'purchase', 'submitted', 'Trần Thị Bình', '0912345678', '079300002222',
     NULL, NULL, NULL, 50000000, 'Đặt mua lô gần cổng chính', FALSE),
    (5, 'reserve', 'pending', 'Lê Văn Cường', '0933445566', '079300003333',
     NULL, NULL, NULL, 48000000, 'Giữ chỗ cho gia đình', FALSE);

-- Request plots (gán lô cho từng request)
INSERT INTO request_plots (request_id, plot_id, plot_price) VALUES
    (1, 3,  52000000),  -- request 1 → lô A-01-003
    (2, 1,  50000000),  -- request 2 → lô A-01-001
    (3, 6,  48000000);  -- request 3 → lô A-02-001

-- Contract mẫu (cho request đã approved)
-- Lưu ý: trigger fn_auto_create_ownership sẽ tự tạo ownership_record khi insert contract
INSERT INTO contracts
    (contract_code, request_id, user_id, plot_id, contract_date,
     total_amount, paid_amount, payment_method, status, created_by, notes)
VALUES
    ('HD-2026-0001', 1, 3, 3, '2026-06-01',
     52000000, 52000000, 'bank_transfer', 'active', 1, 'Hợp đồng mua lô A-01-003');

-- Payment transaction tương ứng
INSERT INTO payment_transactions (contract_id, amount, payment_method, payment_date, reference_code, note, recorded_by)
VALUES (1, 52000000, 'bank_transfer', '2026-06-01', 'FT20260601001', 'Chuyển khoản đủ 100%', 1);

-- Service order mẫu
INSERT INTO service_orders (user_id, plot_id, service_type_id, quantity, unit_price, amount, requested_date, status, note)
VALUES
    (3, 3, 2, 3, 500000, 1500000, '2026-07-01', 'confirmed',  'Chăm sóc mộ 3 tháng'),
    (3, 3, 5, 2, 100000, 200000,  '2026-06-30', 'completed',  'Thắp hương ngày giỗ'),
    (4, 1, 3, 1, 200000, 200000,  '2026-07-05', 'submitted',  'Dọn dẹp mộ');

-- Notification mẫu
INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, channel)
VALUES
    (3, 'request_approved',   'Yêu cầu đã được duyệt',
     'Yêu cầu mua lô A-01-003 của bạn đã được phê duyệt. Hợp đồng HD-2026-0001 đã được tạo.',
     'reservation_request', 1, 'both'),
    (3, 'contract_created',   'Hợp đồng đã được tạo',
     'Hợp đồng HD-2026-0001 đã được tạo thành công. Vui lòng kiểm tra thông tin hợp đồng.',
     'contract', 1, 'in_app'),
    (4, 'request_submitted',  'Yêu cầu đã được gửi',
     'Yêu cầu mua lô của bạn đã được gửi thành công. Chúng tôi sẽ xử lý trong 1-3 ngày làm việc.',
     'reservation_request', 2, 'in_app'),
    (1, 'request_submitted',  'Có yêu cầu mới cần xử lý',
     'Khách hàng Trần Thị Bình vừa gửi yêu cầu mua lô. Vui lòng xem xét và phê duyệt.',
     'reservation_request', 2, 'in_app'),
    (3, 'service_completed',  'Dịch vụ đã hoàn thành',
     'Dịch vụ thắp hương tại lô A-01-003 đã được thực hiện thành công.',
     'service_order', 2, 'both');

-- Reminder mẫu
INSERT INTO reminders (user_id, plot_id, title, description, remind_month, remind_day, reminder_type, is_recurring, notify_days_before)
VALUES
    (3, 3, 'Ngày giỗ của Nguyễn Thị Mẹ',
     'Ngày giỗ hàng năm của cụ Nguyễn Thị Mẹ', 5, 10, 'death_anniversary', TRUE, 3),
    (3, 3, 'Ngày tưởng niệm',
     'Ngày ký hợp đồng 01/06 — nhắc thắp hương',  6,  1, 'memorial',         TRUE, 1);

-- ================================================================
-- GHI CHÚ TRIỂN KHAI CHO BACKEND DEVELOPER
-- ================================================================
--
-- CHẠY FILE NÀY:
--   psql -U postgres -d cemetery_db -f cemetery_management_postgresql.sql
--
-- REDIS CACHE KEYS:
--   plots:map              → SELECT * FROM vw_plots_map       (TTL: 5 phút)
--   plots:map:zone:{id}    → filter theo zone_id              (TTL: 5 phút)
--   dashboard:summary      → SELECT * FROM vw_dashboard_summary (TTL: 1 phút)
--   session:{user_id}      → JWT payload                      (TTL: = token exp)
--   * Invalidate "plots:map*" khi plots.status thay đổi
--
-- FIREBASE STORAGE PATHS:
--   /avatars/{user_id}/avatar.{ext}
--   /documents/requests/{request_id}/{filename}
--   /contracts/{contract_id}/contract.pdf
--   /services/{order_id}/{filename}
--   /transfers/{transfer_id}/{filename}
--
-- CRON JOBS (node-cron):
--   Mỗi ngày 00:00  → SELECT fn_release_expired_reservations();
--   Mỗi ngày 07:00  → Query reminders WHERE remind_month = MONTH(NOW())
--                      AND remind_day BETWEEN DAY(NOW()) AND DAY(NOW())+notify_days_before
--                      AND (last_sent_year IS NULL OR last_sent_year < YEAR(NOW()))
--                    → Gửi notification + email, cập nhật last_sent_at / last_sent_year
--
-- STATUS FLOWS:
--   plots:
--     available → pending (khi request submitted, set reserved_until = NOW()+30min)
--     pending   → reserved (khi request approved)
--     pending   → available (khi request rejected / fn_release_expired_reservations)
--     reserved  → sold (khi contract tạo → trigger tự xử lý)
--     any       → locked (admin khóa thủ công)
--
--   reservation_requests:
--     draft → submitted → pending → approved → [contract tạo]
--                                 → rejected
--     any → cancelled
--
--   contracts:
--     active → expired / transferred / cancelled
--
--   service_orders:
--     submitted → pending_confirm → confirmed → in_progress → completed
--     any → cancelled
--
--   transfer_requests:
--     submitted → pending → approved → [ownership_records cập nhật, contract cũ chuyển]
--                         → rejected
--     any → cancelled
--
-- TRANSACTION KHI APPROVE TRANSFER (phải dùng transaction trong backend):
--   BEGIN;
--     1. UPDATE transfer_requests SET status = 'approved'
--     2. UPDATE ownership_records SET is_current = FALSE, ownership_end = NOW()
--        WHERE plot_id = ? AND is_current = TRUE
--     3. UPDATE contracts SET status = 'transferred' WHERE contract_id = ?
--     4. INSERT INTO contracts (new contract cho recipient)
--        → trigger fn_auto_create_ownership tự tạo ownership_record mới
--     5. INSERT INTO notifications (cho cả 2 bên)
--     6. INSERT INTO audit_logs
--   COMMIT;
--
-- ================================================================
