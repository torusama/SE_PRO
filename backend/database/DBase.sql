-- ================================================================
-- CEMETERY MANAGEMENT SYSTEM â€” PostgreSQL Schema (HoÃ n chá»‰nh 100%)
-- Dá»± Ã¡n: Há»‡ thá»‘ng Quáº£n lÃ½ NghÄ©a trang â€” NhÃ³m 8
-- PhiÃªn báº£n: 2.4 (Patched â€” 29/06/2026)
-- Phá»§ sÃ³ng: FR-01 â†’ FR-14 Ä‘áº§y Ä‘á»§
-- CÃ¡c fix so vá»›i v2.3:
--   [1] contracts: thÃªm cá»™t group_contract_code VARCHAR(50) cho FR-04 (multi-plot grouping)
--   [2] reminders: sá»­a lunar_month CHECK â†’ BETWEEN 1 AND 13, thÃªm is_leap_month BOOLEAN
--   [3] reminders: cáº­p nháº­t vw_reminders_due_today JOIN thÃªm is_leap_month
--   [4] ownership_records: thÃªm UNIQUE PARTIAL INDEX idx_own_one_current_per_plot
-- ================================================================
-- Thá»© tá»± táº¡o báº£ng (phá»¥ thuá»™c FK):
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
    -- Tá»a Ä‘á»™ khung bao zone trÃªn báº£n Ä‘á»“ 2D (Ä‘á»ƒ frontend váº½ ná»n)
    map_x           FLOAT,
    map_y           FLOAT,
    map_width       FLOAT,
    map_height      FLOAT,
    color_hex       VARCHAR(7),     -- MÃ u ná»n zone VD: #FFE4B5
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
    row_number      VARCHAR(10),            -- HÃ ng
    column_number   VARCHAR(10),            -- Cá»™t / sá»‘ thá»© tá»±

    -- Tá»a Ä‘á»™ render báº£n Ä‘á»“ 2D (FR-02)
    map_x           FLOAT           NOT NULL DEFAULT 0,
    map_y           FLOAT           NOT NULL DEFAULT 0,
    map_width       FLOAT           NOT NULL DEFAULT 40,
    map_height      FLOAT           NOT NULL DEFAULT 40,

    -- ThÃ´ng tin lÃ´
    area_sqm        DECIMAL(10,2),
    price           DECIMAL(15,2)   NOT NULL,
    direction       VARCHAR(20),            -- Nam, Báº¯c, ÄÃ´ng, TÃ¢y
    plot_type       VARCHAR(20)     NOT NULL DEFAULT 'single'
                    CHECK (plot_type IN ('single', 'double', 'family')),
    description     TEXT,
    image_url       TEXT,                   -- Firebase Storage URL

    -- Tráº¡ng thÃ¡i
    status          VARCHAR(20)     NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'pending', 'reserved', 'sold', 'locked')),

    -- Lock táº¡m thá»i khi Ä‘ang pending (chá»‘ng race condition FR-03)
    -- ÄÆ°á»£c set tá»± Ä‘á»™ng bá»Ÿi trigger trg_rr_set_plot_pending khi request â†’ submitted
    -- Backend cÅ©ng cÃ³ thá»ƒ set thá»§ cÃ´ng náº¿u cáº§n
    reserved_until  TIMESTAMPTZ,            -- NULL = khÃ´ng lock

    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    -- last_updated Ä‘Ã£ gá»™p vÃ o updated_at (trigger fn_update_updated_at xá»­ lÃ½)
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

    -- ThÃ´ng tin ngÆ°á»i yÃªu cáº§u (cÃ³ thá»ƒ Ä‘áº·t há»™ ngÆ°á»i khÃ¡c)
    requester_name      VARCHAR(100),
    requester_phone     VARCHAR(20),
    requester_id_card   VARCHAR(20),
    requester_address   TEXT,

    -- ThÃ´ng tin ngÆ°á»i Ä‘Æ°á»£c mai tÃ¡ng (Ä‘iá»n khi Ä‘áº·t hoáº·c sau)
    deceased_name       VARCHAR(100),
    deceased_dob        DATE,
    deceased_dod        DATE,
    deceased_gender     VARCHAR(10)     CHECK (deceased_gender IN ('male', 'female', 'other')),

    -- Tá»•ng tiá»n (tÃ­nh khi submit)
    total_price         DECIMAL(15,2),

    -- Ghi chÃº & tÃ i liá»‡u Ä‘Ã­nh kÃ¨m
    note                TEXT,
    document_urls       TEXT[],         -- Firebase Storage URLs (CCCD, giáº¥y tá»...)

    -- Admin xá»­ lÃ½
    admin_id            INT             REFERENCES users(user_id),
    admin_note          TEXT,
    reviewed_at         TIMESTAMPTZ,

    -- Nguá»“n táº¡o
    is_ai_draft         BOOLEAN         NOT NULL DEFAULT FALSE,  -- FR-14

    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rr_user        ON reservation_requests(user_id);
CREATE INDEX idx_rr_status      ON reservation_requests(status);
CREATE INDEX idx_rr_admin       ON reservation_requests(admin_id);

-- ----------------------------------------------------------------
-- 4b. REQUEST_PLOTS â€” nhiá»u lÃ´ cho 1 request (FR-04)
-- ----------------------------------------------------------------
CREATE TABLE request_plots (
    id              SERIAL          PRIMARY KEY,
    request_id      INT             NOT NULL REFERENCES reservation_requests(request_id) ON DELETE CASCADE,
    plot_id         INT             NOT NULL REFERENCES plots(plot_id),
    plot_price      DECIMAL(15,2)   NOT NULL,   -- GiÃ¡ táº¡i thá»i Ä‘iá»ƒm Ä‘áº·t
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

    -- Thá»i háº¡n há»£p Ä‘á»“ng
    contract_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_date      DATE,
    expiry_date         DATE,

    -- TÃ i chÃ­nh
    total_amount        DECIMAL(15,2)   NOT NULL,
    paid_amount         DECIMAL(15,2)   NOT NULL DEFAULT 0,
    payment_method      VARCHAR(30)     CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
    payment_status      VARCHAR(20)     NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    payment_date        DATE,           -- NgÃ y thanh toÃ¡n Ä‘á»§

    -- Tráº¡ng thÃ¡i há»£p Ä‘á»“ng
    status              VARCHAR(20)     NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'expired', 'transferred', 'cancelled')),

    -- File PDF
    pdf_url             TEXT,           -- Firebase Storage URL

    -- Admin táº¡o
    created_by          INT             REFERENCES users(user_id),
    notes               TEXT,

    -- Group contract (FR-04): nhiá»u contract cÃ¹ng 1 Ä‘á»£t mua â†’ group_contract_code giá»‘ng nhau
    -- Format: GRP-{request_id}-{YYYYMMDD}, sinh bá»Ÿi backend khi táº¡o batch contracts
    -- NULL = contract táº¡o Ä‘Æ¡n láº» (khÃ´ng tá»« multi-plot request)
    group_contract_code VARCHAR(50),

    -- Nguá»“n táº¡o ownership (Ä‘á»ƒ trigger fn_auto_create_ownership Ä‘á»c â€” khÃ´ng hardcode)
    -- 'purchase': mua má»›i | 'transfer': chuyá»ƒn nhÆ°á»£ng | 'inheritance': thá»«a káº¿
    ownership_source    VARCHAR(20)     NOT NULL DEFAULT 'purchase'
                        CHECK (ownership_source IN ('purchase', 'transfer', 'inheritance')),

    -- Trace nguá»“n gá»‘c náº¿u contract Ä‘Æ°á»£c táº¡o tá»« transfer/inheritance (nullable)
    -- FK tá»›i transfer_requests Ä‘Æ°á»£c thÃªm sau báº±ng ALTER TABLE (vÃ¬ transfer_requests táº¡o sau contracts)
    source_transfer_id  INT,

    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_user     ON contracts(user_id);
CREATE INDEX idx_contracts_plot     ON contracts(plot_id);
CREATE INDEX idx_contracts_status   ON contracts(status);
CREATE INDEX idx_contracts_code     ON contracts(contract_code);
CREATE INDEX idx_contracts_group    ON contracts(group_contract_code)
    WHERE group_contract_code IS NOT NULL;  -- Query "táº¥t cáº£ lÃ´ mua cÃ¹ng Ä‘á»£t"

-- Äáº£m báº£o má»—i lÃ´ chá»‰ cÃ³ Ä‘Ãºng 1 contract active táº¡i má»™t thá»i Ä‘iá»ƒm (lá»— há»•ng 2)
CREATE UNIQUE INDEX idx_contracts_one_active_per_plot
    ON contracts(plot_id)
    WHERE status = 'active' AND is_deleted = FALSE;

-- ================================================================
-- 6. PAYMENT TRANSACTIONS (FR-12 â€” há»— trá»£ thanh toÃ¡n nhiá»u Ä‘á»£t)
-- ================================================================
CREATE TABLE payment_transactions (
    transaction_id      SERIAL          PRIMARY KEY,
    contract_id         INT             NOT NULL REFERENCES contracts(contract_id),
    amount              DECIMAL(15,2)   NOT NULL,
    payment_method      VARCHAR(30)     NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
    payment_date        DATE            NOT NULL DEFAULT CURRENT_DATE,
    reference_code      VARCHAR(100),   -- MÃ£ giao dá»‹ch ngÃ¢n hÃ ng
    note                TEXT,
    recorded_by         INT             REFERENCES users(user_id),  -- Admin ghi nháº­n
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

    -- NgÆ°á»i Ä‘Æ°á»£c an tÃ¡ng
    deceased_name       VARCHAR(100),
    deceased_dob        DATE,
    deceased_dod        DATE,
    deceased_gender     VARCHAR(10)     CHECK (deceased_gender IN ('male', 'female', 'other')),
    burial_date         DATE,

    -- Thá»i gian sá»Ÿ há»¯u
    ownership_start     DATE            NOT NULL DEFAULT CURRENT_DATE,
    ownership_end       DATE,
    is_current          BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Nguá»“n táº¡o record
    source              VARCHAR(20)     NOT NULL DEFAULT 'purchase'
                        CHECK (source IN ('purchase', 'transfer', 'inheritance')),
    transfer_note       TEXT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_own_plot       ON ownership_records(plot_id);
CREATE INDEX idx_own_user       ON ownership_records(user_id);
CREATE INDEX idx_own_current    ON ownership_records(plot_id, is_current);
-- Äáº£m báº£o má»—i lÃ´ chá»‰ cÃ³ Ä‘Ãºng 1 ownership record is_current = TRUE
-- (contracts Ä‘Ã£ cÃ³ unique index active, ownership cÅ©ng cáº§n Ä‘áº£m báº£o tÆ°Æ¡ng tá»±)
CREATE UNIQUE INDEX idx_own_one_current_per_plot
    ON ownership_records(plot_id)
    WHERE is_current = TRUE;

-- ================================================================
-- 8. TRANSFER / INHERITANCE REQUESTS (FR-05)
-- ================================================================
CREATE TABLE transfer_requests (
    transfer_id             SERIAL          PRIMARY KEY,
    request_type            VARCHAR(20)     NOT NULL
                            CHECK (request_type IN ('transfer', 'inheritance')),

    -- Chá»§ sá»Ÿ há»¯u hiá»‡n táº¡i
    current_owner_id        INT             NOT NULL REFERENCES users(user_id),
    contract_id             INT             NOT NULL REFERENCES contracts(contract_id),
    plot_id                 INT             NOT NULL REFERENCES plots(plot_id),

    -- NgÆ°á»i nháº­n
    recipient_user_id       INT             REFERENCES users(user_id),  -- NULL náº¿u chÆ°a cÃ³ account
    recipient_name          VARCHAR(100)    NOT NULL,
    recipient_phone         VARCHAR(20),
    recipient_id_card       VARCHAR(20),
    recipient_email         VARCHAR(255),
    recipient_address       TEXT,
    recipient_dob           DATE,

    -- LÃ½ do & tÃ i liá»‡u
    reason                  TEXT,
    document_urls           TEXT[],         -- Firebase Storage URLs

    -- Xá»­ lÃ½
    status                  VARCHAR(20)     NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted', 'pending', 'approved', 'rejected', 'cancelled')),
    admin_id                INT             REFERENCES users(user_id),
    admin_note              TEXT,
    reviewed_at             TIMESTAMPTZ,

    -- Káº¿t quáº£ sau approve
    new_ownership_id        INT             REFERENCES ownership_records(ownership_id),
    new_contract_id         INT             REFERENCES contracts(contract_id),

    is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tr_owner       ON transfer_requests(current_owner_id);
CREATE INDEX idx_tr_plot        ON transfer_requests(plot_id);
CREATE INDEX idx_tr_status      ON transfer_requests(status);

-- FK ngÆ°á»£c: contracts.source_transfer_id â†’ transfer_requests (thÃªm sau vÃ¬ circular dependency)
ALTER TABLE contracts
    ADD CONSTRAINT fk_contracts_source_transfer
    FOREIGN KEY (source_transfer_id) REFERENCES transfer_requests(transfer_id);

-- ================================================================
-- 9. SERVICE TYPES (FR-06, FR-11)
-- ================================================================
CREATE TABLE service_types (
    service_type_id     SERIAL          PRIMARY KEY,
    name                VARCHAR(100)    NOT NULL,
    description         TEXT,
    base_price          DECIMAL(15,2)   NOT NULL DEFAULT 0,
    unit                VARCHAR(30)     NOT NULL DEFAULT 'láº§n',  -- láº§n, thÃ¡ng, buá»•i, bá»™
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

    -- Chi tiáº¿t Ä‘Æ¡n hÃ ng
    quantity                INT             NOT NULL DEFAULT 1,
    unit_price              DECIMAL(15,2)   NOT NULL,   -- GiÃ¡ táº¡i thá»i Ä‘iá»ƒm Ä‘áº·t
    amount                  DECIMAL(15,2)   NOT NULL,   -- = quantity Ã— unit_price

    -- Lá»‹ch thá»±c hiá»‡n
    requested_date          DATE,           -- KhÃ¡ch muá»‘n
    scheduled_date          DATE,           -- Admin lÃªn lá»‹ch
    note                    TEXT,

    -- Tráº¡ng thÃ¡i
    status                  VARCHAR(30)     NOT NULL DEFAULT 'submitted'
                            CHECK (status IN (
                                'submitted',
                                'pending_confirm',
                                'confirmed',
                                'in_progress',
                                'completed',
                                'cancelled'
                            )),

    -- HoÃ n thÃ nh (FR-07)
    completion_note         TEXT,
    completion_image_urls   TEXT[],         -- Firebase Storage URLs
    completed_at            TIMESTAMPTZ,

    -- Admin xá»­ lÃ½ & phÃ¢n cÃ´ng (FR-11)
    admin_id                INT             REFERENCES users(user_id),  -- Admin tiáº¿p nháº­n yÃªu cáº§u
    assigned_to             INT             REFERENCES users(user_id),  -- NhÃ¢n viÃªn thá»±c hiá»‡n
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

    -- Loáº¡i thÃ´ng bÃ¡o
    type                    VARCHAR(50)     NOT NULL,
    -- CÃ¡c type há»£p lá»‡ (comment Ä‘á»ƒ backend biáº¿t):
    -- request_submitted | request_approved | request_rejected | request_cancelled
    -- contract_created | contract_updated | contract_pdf_ready
    -- service_submitted | service_confirmed | service_in_progress | service_completed | service_cancelled
    -- transfer_submitted | transfer_approved | transfer_rejected
    -- memorial_reminder | system_update

    title                   VARCHAR(255)    NOT NULL,
    message                 TEXT            NOT NULL,

    -- LiÃªn káº¿t entity
    related_entity_type     VARCHAR(50),    -- 'reservation_request' | 'contract' | 'service_order' | 'transfer_request' | 'reminder'
    related_entity_id       INT,

    -- KÃªnh gá»­i
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
-- 12. REMINDERS â€” Nháº¯c lá»‹ch ngÃ y giá»— / tÆ°á»Ÿng niá»‡m (FR-08)
-- ================================================================
CREATE TABLE reminders (
    reminder_id         SERIAL          PRIMARY KEY,
    user_id             INT             NOT NULL REFERENCES users(user_id),
    plot_id             INT             REFERENCES plots(plot_id),
    ownership_id        INT             REFERENCES ownership_records(ownership_id),

    title               VARCHAR(255)    NOT NULL,   -- "NgÃ y giá»— cá»§a Nguyá»…n VÄƒn A"
    description         TEXT,

    -- DÆ°Æ¡ng lá»‹ch: lÆ°u thÃ¡ng + ngÃ y riÃªng Ä‘á»ƒ cron so sÃ¡nh hÃ ng nÄƒm
    remind_month        SMALLINT        NOT NULL CHECK (remind_month BETWEEN 1 AND 12),
    remind_day          SMALLINT        NOT NULL CHECK (remind_day   BETWEEN 1 AND 31),
    -- Ã‚m lá»‹ch (tham kháº£o, khÃ´ng báº¯t buá»™c)
    lunar_month         SMALLINT        CHECK (lunar_month BETWEEN 1 AND 13),  -- 13 = thÃ¡ng nhuáº­n
    lunar_day           SMALLINT        CHECK (lunar_day   BETWEEN 1 AND 30),
    is_leap_month       BOOLEAN         NOT NULL DEFAULT FALSE,  -- TRUE náº¿u ngÃ y giá»— rÆ¡i vÃ o thÃ¡ng nhuáº­n
    -- is_leap_month dÃ¹ng Ä‘á»ƒ JOIN lunar_to_solar_map.is_leap_month khi map Ã¢m â†’ dÆ°Æ¡ng

    -- NgÃ y cá»¥ thá»ƒ (cho nháº¯c 1 láº§n, khÃ´ng láº·p)
    specific_date       DATE,

    reminder_type       VARCHAR(20)     NOT NULL DEFAULT 'death_anniversary'
                        CHECK (reminder_type IN ('death_anniversary', 'memorial', 'maintenance', 'other')),
    is_recurring        BOOLEAN         NOT NULL DEFAULT TRUE,  -- HÃ ng nÄƒm?
    notify_days_before  INT             NOT NULL DEFAULT 3,     -- Nháº¯c trÆ°á»›c bao nhiÃªu ngÃ y

    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_deleted          BOOLEAN         NOT NULL DEFAULT FALSE,
    last_sent_at        TIMESTAMPTZ,
    last_sent_year      INT,

    -- Validate: náº¿u is_recurring = TRUE thÃ¬ khÃ´ng Ä‘Æ°á»£c cÃ³ specific_date, vÃ  ngÆ°á»£c láº¡i
    CONSTRAINT chk_reminder_recurring_vs_specific
        CHECK (
            (is_recurring = TRUE  AND specific_date IS NULL) OR
            (is_recurring = FALSE AND specific_date IS NOT NULL)
        ),

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
    session_id              VARCHAR(100)    NOT NULL,       -- ID phiÃªn chatbot

    -- Version model/logic AI
    model_version           VARCHAR(50)     NOT NULL DEFAULT 'v1.0',

    -- Input tá»« khÃ¡ch hÃ ng (thu tháº­p qua chatbot)
    budget_min              DECIMAL(15,2),
    budget_max              DECIMAL(15,2),
    num_plots_needed        INT,
    preferred_zone_id       INT             REFERENCES cemetery_zones(zone_id),
    preferred_direction     VARCHAR(20),
    family_size             INT,
    plot_type_preference    VARCHAR(20),
    special_requirements    TEXT,
    bazi_info               TEXT,           -- BÃ¡t tá»± (tham kháº£o tÃ¢m linh)

    -- Output AI
    recommended_plot_ids    INT[],          -- Danh sÃ¡ch plot_id Ä‘Æ°á»£c gá»£i Ã½
    recommendation_note     TEXT,           -- Giáº£i thÃ­ch lÃ½ do gá»£i Ã½
    estimated_total         DECIMAL(15,2),

    -- HÃ nh Ä‘á»™ng agentic
    draft_request_id        INT             REFERENCES reservation_requests(request_id),
    map_highlight_sent      BOOLEAN         NOT NULL DEFAULT FALSE,

    -- ToÃ n bá»™ lá»‹ch sá»­ chat (JSONB Ä‘á»ƒ query linh hoáº¡t)
    conversation_log        JSONB,

    -- Pháº£n há»“i ngÆ°á»i dÃ¹ng
    user_rating             SMALLINT        CHECK (user_rating BETWEEN 1 AND 5),
    user_feedback           TEXT,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_user        ON ai_recommendation_logs(user_id);
CREATE INDEX idx_ai_session     ON ai_recommendation_logs(session_id);
CREATE INDEX idx_ai_version     ON ai_recommendation_logs(model_version);

-- ================================================================
-- 14. AUDIT LOGS (FR-13 â€” lá»‹ch sá»­ thao tÃ¡c)
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

-- HÃ m cáº­p nháº­t updated_at tá»± Ä‘á»™ng
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gáº¯n trigger updated_at cho táº¥t cáº£ báº£ng cáº§n thiáº¿t
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
-- Trigger: Khi contract Ä‘Æ°á»£c táº¡o â†’ tá»± Ä‘á»™ng táº¡o ownership_record
-- Fix bug 2: source khÃ´ng hardcode 'purchase' ná»¯a mÃ  Ä‘á»c tá»« contracts.ownership_source
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auto_create_ownership()
RETURNS TRIGGER AS $$
BEGIN
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
            NEW.ownership_source   -- Ä‘á»c tá»« column, khÃ´ng hardcode
        );

        -- Cáº­p nháº­t tráº¡ng thÃ¡i lÃ´ Ä‘áº¥t â†’ sold
        UPDATE plots
        SET    status         = 'sold',
               reserved_until = NULL
        WHERE  plot_id        = NEW.plot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_create_ownership
    AFTER INSERT ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_auto_create_ownership();

-- ----------------------------------------------------------------
-- Trigger: Khi paid_amount thay Ä‘á»•i â†’ tá»± cáº­p nháº­t payment_status
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
-- Trigger: Khi payment_transaction Ä‘Æ°á»£c thÃªm â†’ cá»™ng vÃ o paid_amount cá»§a contract
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

-- (Trigger plot_status_change Ä‘Ã£ Ä‘Æ°á»£c gá»™p vÃ o fn_update_updated_at â€”
--  updated_at tá»± cáº­p nháº­t má»—i khi cÃ³ UPDATE, ká»ƒ cáº£ thay Ä‘á»•i status)

-- ----------------------------------------------------------------
-- Trigger: Khi reservation_request chuyá»ƒn sang 'submitted'
--          â†’ tá»± Ä‘á»™ng set plots.status = 'pending'
--             vÃ  reserved_until = NOW() + 30 phÃºt (chá»‘ng race condition FR-03)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rr_submitted_lock_plots()
RETURNS TRIGGER AS $$
BEGIN
    -- Chá»‰ xá»­ lÃ½ khi status chuyá»ƒn sang 'submitted'
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'submitted') THEN
        UPDATE plots p
        SET    status         = 'pending',
               reserved_until = NOW() + INTERVAL '30 minutes',
               updated_at     = NOW()
        FROM   request_plots rp
        WHERE  rp.request_id = NEW.request_id
          AND  rp.plot_id    = p.plot_id
          AND  p.status      = 'available';  -- chá»‰ lock lÃ´ cÃ²n trá»‘ng
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rr_set_plot_pending
    AFTER UPDATE OF status ON reservation_requests
    FOR EACH ROW EXECUTE FUNCTION fn_rr_submitted_lock_plots();

-- ----------------------------------------------------------------
-- HÃ m release lÃ´ Ä‘áº¥t háº¿t háº¡n reserved_until (gá»i tá»« cron job)
-- Fix lá»— há»•ng 1: Ä‘á»“ng thá»i cancel reservation_requests tÆ°Æ¡ng á»©ng
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_release_expired_reservations()
RETURNS INT AS $$
DECLARE
    released INT;
BEGIN
    -- BÆ°á»›c 1: Cancel cÃ¡c reservation_request Ä‘ang pending/submitted
    -- mÃ  lÃ´ Ä‘áº¥t tÆ°Æ¡ng á»©ng Ä‘Ã£ háº¿t háº¡n reserved_until
    UPDATE reservation_requests rr
    SET    status     = 'cancelled',
           admin_note = COALESCE(admin_note || ' | ', '') ||
                        'Tá»± Ä‘á»™ng huá»· do háº¿t thá»i gian giá»¯ chá»— (' || NOW()::TEXT || ')',
           updated_at = NOW()
    WHERE  rr.status IN ('submitted', 'pending')
      AND  EXISTS (
               SELECT 1
               FROM   request_plots rp
               JOIN   plots p ON rp.plot_id = p.plot_id
               WHERE  rp.request_id = rr.request_id
                 AND  p.status      = 'pending'
                 AND  p.reserved_until < NOW()
           );

    -- BÆ°á»›c 2: Reset lÃ´ Ä‘áº¥t vá» available
    UPDATE plots
    SET    status         = 'available',
           reserved_until = NULL,
           updated_at     = NOW()
    WHERE  status         = 'pending'
      AND  reserved_until < NOW();

    GET DIAGNOSTICS released = ROW_COUNT;
    RETURN released;
END;
$$ LANGUAGE plpgsql;
-- DÃ¹ng: SELECT fn_release_expired_reservations();

-- ================================================================
-- 16. VIEWS Há»– TRá»¢ DASHBOARD & API (FR-13, FR-02)
-- ================================================================

-- Báº£n Ä‘á»“ 2D Ä‘áº§y Ä‘á»§ thÃ´ng tin (FR-02)
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
    p.reserved_until,    -- Chá»§ sá»Ÿ há»¯u hiá»‡n táº¡i
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

-- Thá»‘ng kÃª lÃ´ Ä‘áº¥t (FR-13)
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

-- Doanh thu theo thÃ¡ng (FR-13)
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

-- Thá»‘ng kÃª dá»‹ch vá»¥ (FR-13)
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

-- Tá»•ng quan dashboard admin (FR-13)
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM plots          WHERE is_deleted = FALSE)                          AS total_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'available' AND is_deleted = FALSE) AS available_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'pending'   AND is_deleted = FALSE) AS pending_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'reserved'  AND is_deleted = FALSE) AS reserved_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'sold'      AND is_deleted = FALSE) AS sold_plots,
    (SELECT COUNT(*) FROM plots          WHERE status = 'locked'    AND is_deleted = FALSE) AS locked_plots,
    -- Kiá»ƒm tra: available+pending+reserved+sold+locked pháº£i = total_plots
    (SELECT COUNT(*) FROM users          WHERE role = 'Customer'    AND is_deleted = FALSE) AS total_customers,
    (SELECT COUNT(*) FROM reservation_requests WHERE status IN ('submitted', 'pending') AND is_deleted = FALSE) AS pending_requests,
    (SELECT COUNT(*) FROM service_orders WHERE status IN ('submitted','pending_confirm','confirmed','in_progress') AND is_deleted = FALSE) AS active_services,
    (SELECT COUNT(*) FROM contracts      WHERE status = 'active'    AND is_deleted = FALSE) AS active_contracts,
    (SELECT COALESCE(SUM(paid_amount),0) FROM contracts WHERE status = 'active' AND is_deleted = FALSE) AS total_collected;

-- Danh sÃ¡ch yÃªu cáº§u Ä‘áº·t lÃ´ Ä‘áº§y Ä‘á»§ (API admin)
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
    -- Danh sÃ¡ch lÃ´ (aggregate)
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

-- Users (password hash lÃ  placeholder â€” backend sáº½ hash báº±ng bcrypt)
INSERT INTO users (email, password_hash, role, full_name, phone_number, address, id_card_number, date_of_birth, gender) VALUES
('admin@cemetery.vn',        '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',   'Admin',    'Quáº£n trá»‹ viÃªn Há»‡ thá»‘ng',  '0901234567', 'TP. Há»“ ChÃ­ Minh',  '079200001111', '1985-03-15', 'male'),
('admin2@cemetery.vn',       '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',  'Admin',    'PhÃ³ Quáº£n trá»‹ viÃªn',       '0901234568', 'TP. Há»“ ChÃ­ Minh',  '079200002222', '1990-07-20', 'female'),
('khachhang1@gmail.com',     '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',   'Customer', 'Nguyá»…n VÄƒn An',           '0987654321', 'Quáº­n 1, TP.HCM',   '079300001111', '1975-05-10', 'male'),
('khachhang2@gmail.com',     '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',   'Customer', 'Tráº§n Thá»‹ BÃ¬nh',           '0912345678', 'Quáº­n 3, TP.HCM',   '079300002222', '1980-09-22', 'female'),
('khachhang3@gmail.com',     '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',   'Customer', 'LÃª VÄƒn CÆ°á»ng',            '0933445566', 'Quáº­n 7, TP.HCM',   '079300003333', '1968-12-01', 'male'),
('khachhang4@gmail.com',     '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu',   'Customer', 'Pháº¡m Thá»‹ Dung',           '0944556677', 'BÃ¬nh DÆ°Æ¡ng',        '079300004444', '1955-03-30', 'female');

-- Cemetery Zones
INSERT INTO cemetery_zones (zone_code, zone_name, description, map_x, map_y, map_width, map_height, color_hex, sort_order) VALUES
('A', 'Khu A â€” Cao Cáº¥p',    'Khu vá»±c cao cáº¥p, phong thá»§y tá»‘t, gáº§n cá»•ng chÃ­nh', 0,   0,   300, 250, '#FFF3CD', 1),
('B', 'Khu B â€” TiÃªu Chuáº©n', 'Khu vá»±c tiÃªu chuáº©n, diá»‡n tÃ­ch vá»«a pháº£i',          310, 0,   300, 250, '#D1ECF1', 2),
('C', 'Khu C â€” Gia ÄÃ¬nh',   'Khu vá»±c dÃ nh cho nhÃ³m lÃ´ gia Ä‘Ã¬nh hoáº·c dÃ²ng há»',  0,   260, 300, 300, '#D4EDDA', 3),
('D', 'Khu D â€” BÃ¬nh DÃ¢n',   'Khu vá»±c giÃ¡ phá»• thÃ´ng',                            310, 260, 300, 300, '#F8D7DA', 4);

-- Plots â€” Khu A (10 lÃ´ Ä‘Æ¡n + 2 lÃ´ Ä‘Ã´i)
-- LÆ°u Ã½: A-02-001 vÃ  A-02-003 seed tháº³ng status 'pending' (khÃ´ng qua trigger),
--        nÃªn pháº£i set reserved_until thá»§ cÃ´ng Ä‘á»ƒ cron fn_release_expired_reservations hoáº¡t Ä‘á»™ng Ä‘Ãºng khi test.
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('A-01-001', 1, '01', '001',  10,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-01-002', 1, '01', '002',  55,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-01-003', 1, '01', '003', 100,  10, 40, 40, 4.0,  52000000, 'ÄÃ´ng',  'single', 'sold'),
('A-01-004', 1, '01', '004', 145,  10, 40, 40, 4.0,  52000000, 'ÄÃ´ng',  'single', 'reserved'),
('A-01-005', 1, '01', '005', 190,  10, 40, 40, 4.0,  50000000, 'Nam',   'single', 'available'),
('A-02-001', 1, '02', '001',  10,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'available'),
('A-02-002', 1, '02', '002',  55,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'available'),
('A-02-003', 1, '02', '003', 100,  60, 40, 40, 4.0,  49000000, 'TÃ¢y',   'single', 'available'),
('A-02-004', 1, '02', '004', 145,  60, 40, 40, 4.0,  49000000, 'TÃ¢y',   'single', 'available'),
('A-02-005', 1, '02', '005', 190,  60, 40, 40, 4.0,  48000000, 'Nam',   'single', 'sold'),
('A-03-001', 1, '03', '001',  10, 110, 85, 40, 8.0,  95000000, 'Nam',   'double', 'available'),
('A-03-002', 1, '03', '002', 100, 110, 85, 40, 8.0,  95000000, 'Nam',   'double', 'locked');

-- Set tráº¡ng thÃ¡i pending + reserved_until cho 2 lÃ´ Ä‘ang bá»‹ giá»¯ chá»— bá»Ÿi request máº«u
-- (Pháº£i cháº¡y sau INSERT plots vÃ¬ trigger khÃ´ng fire trÃªn INSERT tháº³ng)
UPDATE plots SET status = 'pending', reserved_until = NOW() + INTERVAL '30 minutes'
WHERE plot_code IN ('A-02-001', 'A-02-003');

-- Plots â€” Khu B (10 lÃ´ Ä‘Æ¡n)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('B-01-001', 2, '01', '001',  10,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-01-002', 2, '01', '002',  55,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-01-003', 2, '01', '003', 100,  10, 40, 40, 3.5, 31000000, 'ÄÃ´ng',  'single', 'sold'),
('B-01-004', 2, '01', '004', 145,  10, 40, 40, 3.5, 31000000, 'ÄÃ´ng',  'single', 'available'),
('B-01-005', 2, '01', '005', 190,  10, 40, 40, 3.5, 30000000, 'Nam',   'single', 'available'),
('B-02-001', 2, '02', '001',  10,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'available'),
('B-02-002', 2, '02', '002',  55,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'available'),
('B-02-003', 2, '02', '003', 100,  60, 40, 40, 3.5, 30000000, 'Báº¯c',   'single', 'available'),
('B-02-004', 2, '02', '004', 145,  60, 40, 40, 3.5, 30000000, 'Báº¯c',   'single', 'available'),
('B-02-005', 2, '02', '005', 190,  60, 40, 40, 3.5, 29000000, 'Nam',   'single', 'sold');

-- Plots â€” Khu C (6 lÃ´ gia Ä‘Ã¬nh)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('C-01-001', 3, '01', '001',  10,  10, 80, 80, 12.0, 120000000, 'Nam',  'family', 'available'),
('C-01-002', 3, '01', '002', 100,  10, 80, 80, 12.0, 120000000, 'Nam',  'family', 'available'),
('C-01-003', 3, '01', '003', 190,  10, 80, 80, 12.0, 118000000, 'ÄÃ´ng', 'family', 'available'),
('C-02-001', 3, '02', '001',  10, 100, 80, 80, 12.0, 115000000, 'ÄÃ´ng', 'family', 'sold'),
('C-02-002', 3, '02', '002', 100, 100, 80, 80, 12.0, 115000000, 'ÄÃ´ng', 'family', 'available'),
('C-02-003', 3, '02', '003', 190, 100, 80, 80, 12.0, 113000000, 'Nam',  'family', 'available');

-- Plots â€” Khu D (8 lÃ´ bÃ¬nh dÃ¢n)
INSERT INTO plots (plot_code, zone_id, row_number, column_number, map_x, map_y, map_width, map_height, area_sqm, price, direction, plot_type, status) VALUES
('D-01-001', 4, '01', '001',  10,  10, 40, 40, 3.0, 20000000, 'Nam',   'single', 'available'),
('D-01-002', 4, '01', '002',  55,  10, 40, 40, 3.0, 20000000, 'Nam',   'single', 'available'),
('D-01-003', 4, '01', '003', 100,  10, 40, 40, 3.0, 21000000, 'ÄÃ´ng',  'single', 'available'),
('D-01-004', 4, '01', '004', 145,  10, 40, 40, 3.0, 21000000, 'ÄÃ´ng',  'single', 'sold'),
('D-02-001', 4, '02', '001',  10,  60, 40, 40, 3.0, 19000000, 'Nam',   'single', 'available'),
('D-02-002', 4, '02', '002',  55,  60, 40, 40, 3.0, 19000000, 'Nam',   'single', 'available'),
('D-02-003', 4, '02', '003', 100,  60, 40, 40, 3.0, 20000000, 'Báº¯c',   'single', 'available'),
('D-02-004', 4, '02', '004', 145,  60, 40, 40, 3.0, 20000000, 'Báº¯c',   'single', 'available');

-- Service Types
INSERT INTO service_types (name, description, base_price, unit, category, sort_order) VALUES
('Dá»‹ch vá»¥ mai tÃ¡ng',        'Há»— trá»£ toÃ n bá»™ quy trÃ¬nh mai tÃ¡ng táº¡i nghÄ©a trang',    5000000,  'láº§n',   'burial',      1),
('ChÄƒm sÃ³c má»™ Ä‘á»‹nh ká»³',     'Vá»‡ sinh, chÄƒm sÃ³c má»™ pháº§n hÃ ng thÃ¡ng',                 500000,   'thÃ¡ng', 'maintenance', 2),
('Dá»n dáº¹p má»™',              'LÃ m cá», vá»‡ sinh khu vá»±c xung quanh má»™',                200000,   'láº§n',   'maintenance', 3),
('Thay hoa tÆ°Æ¡i',           'Thay hoa tÆ°Æ¡i theo yÃªu cáº§u',                            150000,   'láº§n',   'maintenance', 4),
('Tháº¯p hÆ°Æ¡ng',              'Tháº¯p hÆ°Æ¡ng táº¡i má»™ vÃ o cÃ¡c ngÃ y Ä‘áº·c biá»‡t',              100000,   'láº§n',   'memorial',    5),
('Dá»‹ch vá»¥ tÆ°á»Ÿng niá»‡m',      'Tá»• chá»©c buá»•i lá»… tÆ°á»Ÿng niá»‡m táº¡i má»™ pháº§n',              2000000,  'buá»•i',  'memorial',    6),
('SÆ¡n sá»­a bia má»™',          'SÆ¡n láº¡i bia má»™ vÃ  khu vá»±c xung quanh',                1500000,  'láº§n',   'maintenance', 7),
('Chá»¥p áº£nh má»™ pháº§n',        'Ghi láº¡i hÃ¬nh áº£nh má»™ pháº§n vÃ  gá»­i vá» cho gia Ä‘Ã¬nh',      300000,   'láº§n',   'other',       8);

-- Reservation Request máº«u (status = approved â†’ contract sáº½ táº¡o riÃªng)
INSERT INTO reservation_requests
    (user_id, request_type, status, requester_name, requester_phone, requester_id_card,
     deceased_name, deceased_dob, deceased_dod, total_price, note, is_ai_draft)
VALUES
    (3, 'purchase', 'approved', 'Nguyá»…n VÄƒn An', '0987654321', '079300001111',
     'Nguyá»…n Thá»‹ Máº¹', '1948-01-15', '2026-05-10', 52000000, 'YÃªu cáº§u mua lÃ´ A-01-003', FALSE),
    (4, 'purchase', 'submitted', 'Tráº§n Thá»‹ BÃ¬nh', '0912345678', '079300002222',
     NULL, NULL, NULL, 50000000, 'Äáº·t mua lÃ´ gáº§n cá»•ng chÃ­nh', FALSE),
    (5, 'reserve', 'pending', 'LÃª VÄƒn CÆ°á»ng', '0933445566', '079300003333',
     NULL, NULL, NULL, 48000000, 'Giá»¯ chá»— cho gia Ä‘Ã¬nh', FALSE);

-- Request plots (gÃ¡n lÃ´ cho tá»«ng request)
INSERT INTO request_plots (request_id, plot_id, plot_price) VALUES
    (1, 3,  52000000),  -- request 1 â†’ lÃ´ A-01-003
    (2, 1,  50000000),  -- request 2 â†’ lÃ´ A-01-001
    (3, 6,  48000000);  -- request 3 â†’ lÃ´ A-02-001

-- Contract máº«u â€” paid_amount = 0 (trigger fn_accum_payment sáº½ cá»™ng khi insert payment_transaction)
-- KHÃ”NG seed paid_amount trá»±c tiáº¿p Ä‘á»ƒ trÃ¡nh nhÃ¢n Ä‘Ã´i sá»‘ tiá»n (bug 1)
INSERT INTO contracts
    (contract_code, request_id, user_id, plot_id, contract_date,
     total_amount, paid_amount, payment_method, ownership_source, status, created_by, notes)
VALUES
    ('HD-2026-0001', 1, 3, 3, '2026-06-01',
     52000000, 0, 'bank_transfer', 'purchase', 'active', 1, 'Há»£p Ä‘á»“ng mua lÃ´ A-01-003');

-- Payment transaction â€” trigger fn_accum_payment tá»± cá»™ng vÃ o contracts.paid_amount
-- Sau khi insert: paid_amount = 0 + 52000000 = 52000000 âœ“
INSERT INTO payment_transactions (contract_id, amount, payment_method, payment_date, reference_code, note, recorded_by)
VALUES (1, 52000000, 'bank_transfer', '2026-06-01', 'FT20260601001', 'Chuyá»ƒn khoáº£n Ä‘á»§ 100%', 1);

-- Service order máº«u
INSERT INTO service_orders (user_id, plot_id, service_type_id, quantity, unit_price, amount, requested_date, status, note)
VALUES
    (3, 3, 2, 3, 500000, 1500000, '2026-07-01', 'confirmed',  'ChÄƒm sÃ³c má»™ 3 thÃ¡ng'),
    (3, 3, 5, 2, 100000, 200000,  '2026-06-30', 'completed',  'Tháº¯p hÆ°Æ¡ng ngÃ y giá»—'),
    (4, 1, 3, 1, 200000, 200000,  '2026-07-05', 'submitted',  'Dá»n dáº¹p má»™');

-- Notification máº«u
INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, channel)
VALUES
    (3, 'request_approved',   'YÃªu cáº§u Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t',
     'YÃªu cáº§u mua lÃ´ A-01-003 cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t. Há»£p Ä‘á»“ng HD-2026-0001 Ä‘Ã£ Ä‘Æ°á»£c táº¡o.',
     'reservation_request', 1, 'both'),
    (3, 'contract_created',   'Há»£p Ä‘á»“ng Ä‘Ã£ Ä‘Æ°á»£c táº¡o',
     'Há»£p Ä‘á»“ng HD-2026-0001 Ä‘Ã£ Ä‘Æ°á»£c táº¡o thÃ nh cÃ´ng. Vui lÃ²ng kiá»ƒm tra thÃ´ng tin há»£p Ä‘á»“ng.',
     'contract', 1, 'in_app'),
    (4, 'request_submitted',  'YÃªu cáº§u Ä‘Ã£ Ä‘Æ°á»£c gá»­i',
     'YÃªu cáº§u mua lÃ´ cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c gá»­i thÃ nh cÃ´ng. ChÃºng tÃ´i sáº½ xá»­ lÃ½ trong 1-3 ngÃ y lÃ m viá»‡c.',
     'reservation_request', 2, 'in_app'),
    (1, 'request_submitted',  'CÃ³ yÃªu cáº§u má»›i cáº§n xá»­ lÃ½',
     'KhÃ¡ch hÃ ng Tráº§n Thá»‹ BÃ¬nh vá»«a gá»­i yÃªu cáº§u mua lÃ´. Vui lÃ²ng xem xÃ©t vÃ  phÃª duyá»‡t.',
     'reservation_request', 2, 'in_app'),
    (3, 'service_completed',  'Dá»‹ch vá»¥ Ä‘Ã£ hoÃ n thÃ nh',
     'Dá»‹ch vá»¥ tháº¯p hÆ°Æ¡ng táº¡i lÃ´ A-01-003 Ä‘Ã£ Ä‘Æ°á»£c thá»±c hiá»‡n thÃ nh cÃ´ng.',
     'service_order', 2, 'both');

-- Reminder máº«u
INSERT INTO reminders (user_id, plot_id, title, description, remind_month, remind_day, reminder_type, is_recurring, notify_days_before)
VALUES
    (3, 3, 'NgÃ y giá»— cá»§a Nguyá»…n Thá»‹ Máº¹',
     'NgÃ y giá»— hÃ ng nÄƒm cá»§a cá»¥ Nguyá»…n Thá»‹ Máº¹', 5, 10, 'death_anniversary', TRUE, 3),
    (3, 3, 'NgÃ y tÆ°á»Ÿng niá»‡m',
     'NgÃ y kÃ½ há»£p Ä‘á»“ng 01/06 â€” nháº¯c tháº¯p hÆ°Æ¡ng',  6,  1, 'memorial',         TRUE, 1);

-- ================================================================
-- GHI CHÃš TRIá»‚N KHAI CHO BACKEND DEVELOPER
-- ================================================================
--
-- CHáº Y FILE NÃ€Y:
--   psql -U postgres -d cemetery_db -f cemetery_management_postgresql.sql
--
-- REDIS CACHE KEYS:
--   plots:map              â†’ SELECT * FROM vw_plots_map       (TTL: 5 phÃºt)
--   plots:map:zone:{id}    â†’ filter theo zone_id              (TTL: 5 phÃºt)
--   dashboard:summary      â†’ SELECT * FROM vw_dashboard_summary (TTL: 1 phÃºt)
--   session:{user_id}      â†’ JWT payload                      (TTL: = token exp)
--   * Invalidate "plots:map*" khi plots.status thay Ä‘á»•i
--
-- FIREBASE STORAGE PATHS:
--   /avatars/{user_id}/avatar.{ext}
--   /documents/requests/{request_id}/{filename}
--   /contracts/{contract_id}/contract.pdf
--   /services/{order_id}/{filename}
--   /transfers/{transfer_id}/{filename}
--
-- CRON JOBS (node-cron):
--   Má»—i ngÃ y 00:00  â†’ SELECT fn_release_expired_reservations();
--   Má»—i ngÃ y 07:00  â†’ Query reminders WHERE remind_month = EXTRACT(MONTH FROM NOW())
--                      AND remind_day BETWEEN EXTRACT(DAY FROM NOW())
--                                         AND EXTRACT(DAY FROM NOW()) + notify_days_before
--                      AND (last_sent_year IS NULL OR last_sent_year < EXTRACT(YEAR FROM NOW()))
--                    â†’ Gá»­i notification + email, cáº­p nháº­t last_sent_at / last_sent_year
--
-- STATUS FLOWS:
--   plots:
--     available â†’ pending (khi request submitted, set reserved_until = NOW()+30min)
--     pending   â†’ reserved (khi request approved)
--     pending   â†’ available (khi request rejected / fn_release_expired_reservations)
--     reserved  â†’ sold (khi contract táº¡o â†’ trigger tá»± xá»­ lÃ½)
--     any       â†’ locked (admin khÃ³a thá»§ cÃ´ng)
--
--   reservation_requests:
--     draft â†’ submitted â†’ pending â†’ approved â†’ [contract táº¡o]
--                                 â†’ rejected
--     any â†’ cancelled
--
--   contracts:
--     active â†’ expired / transferred / cancelled
--
--   service_orders:
--     submitted â†’ pending_confirm â†’ confirmed â†’ in_progress â†’ completed
--     any â†’ cancelled
--
--   transfer_requests:
--     submitted â†’ pending â†’ approved â†’ [ownership_records cáº­p nháº­t, contract cÅ© chuyá»ƒn]
--                         â†’ rejected
--     any â†’ cancelled
--
-- TRANSACTION KHI APPROVE TRANSFER (pháº£i dÃ¹ng transaction trong backend):
--   BEGIN;
--     0. Kiá»ƒm tra transfer_requests.recipient_user_id:
--        - Náº¿u NULL â†’ backend pháº£i táº¡o user má»›i trÆ°á»›c (hoáº·c yÃªu cáº§u recipient Ä‘Äƒng kÃ½)
--        - Náº¿u cÃ³ â†’ dÃ¹ng recipient_user_id lÃ m user_id cho contract má»›i
--     1. UPDATE transfer_requests SET status = 'approved'
--     2. UPDATE ownership_records SET is_current = FALSE, ownership_end = NOW()
--        WHERE plot_id = ? AND is_current = TRUE
--     3. UPDATE contracts SET status = 'transferred' WHERE contract_id = ?
--     4. INSERT INTO contracts (..., user_id = recipient_user_id, ownership_source = 'transfer'/'inheritance')
--        â†’ trigger fn_auto_create_ownership tá»± táº¡o ownership_record má»›i vá»›i Ä‘Ãºng source
--     5. UPDATE transfer_requests SET new_contract_id = ?, new_ownership_id = ?
--     6. INSERT INTO notifications (cho cáº£ 2 bÃªn)
--     7. INSERT INTO audit_logs
--   COMMIT;
--
-- ================================================================

-- =====================
-- APPENDED PATCH v2.4
-- =====================

-- ================================================================
-- CEMETERY MANAGEMENT SYSTEM â€” Patch v2.4
-- Bá»• sung tá»« v2.3: refresh_tokens, lunar reminder, seed passwords
-- Ãp dá»¥ng: psql -U postgres -d cemetery_db -f cemetery_patch_v2_4.sql
-- YÃªu cáº§u: Ä‘Ã£ cháº¡y cemetery_management_postgresql_v2_3.sql trÆ°á»›c
-- ================================================================

-- ================================================================
-- PATCH 1: REFRESH TOKENS â€” Quáº£n lÃ½ session / logout (FR-01)
-- ================================================================
-- LÃ½ do cáº§n: JWT stateless khÃ´ng thá»ƒ revoke khi logout hoáº·c Ä‘á»•i máº­t kháº©u.
-- Báº£ng nÃ y lÆ°u refresh token Ä‘á»ƒ backend kiá»ƒm tra há»£p lá»‡ trÆ°á»›c khi cáº¥p
-- access token má»›i. Khi logout â†’ xÃ³a / Ä‘Ã¡nh dáº¥u revoked.
-- ----------------------------------------------------------------

CREATE TABLE refresh_tokens (
    token_id        SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Token value (lÆ°u dáº¡ng hash SHA-256, khÃ´ng lÆ°u raw)
    token_hash      VARCHAR(64)     NOT NULL UNIQUE,    -- SHA-256 hex = 64 kÃ½ tá»±

    -- Thiáº¿t bá»‹ / client (giÃºp admin xem session Ä‘ang hoáº¡t Ä‘á»™ng)
    device_info     TEXT,           -- VD: "Chrome 125 / Windows 11"
    ip_address      VARCHAR(45),    -- IPv4 hoáº·c IPv6
    user_agent      TEXT,

    -- VÃ²ng Ä‘á»i
    issued_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW() + INTERVAL '30 days',

    -- Revoke (logout thá»§ cÃ´ng hoáº·c Ä‘á»•i máº­t kháº©u)
    is_revoked      BOOLEAN         NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    revoke_reason   VARCHAR(50)
                    CHECK (revoke_reason IN ('logout', 'password_changed', 'admin_revoke', 'expired'))
);

CREATE INDEX idx_rt_user        ON refresh_tokens(user_id);
CREATE INDEX idx_rt_hash        ON refresh_tokens(token_hash);
CREATE INDEX idx_rt_active      ON refresh_tokens(user_id, is_revoked, expires_at);

-- Tá»± Ä‘á»™ng dá»n token háº¿t háº¡n / Ä‘Ã£ revoke sau 90 ngÃ y (giá»¯ audit trail ngáº¯n háº¡n)
-- Gá»i báº±ng cron: SELECT fn_cleanup_expired_tokens();
CREATE OR REPLACE FUNCTION fn_cleanup_expired_tokens()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM refresh_tokens
    WHERE  (is_revoked = TRUE  AND revoked_at  < NOW() - INTERVAL '90 days')
       OR  (is_revoked = FALSE AND expires_at  < NOW() - INTERVAL '90 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- PATCH 2: LUNAR CALENDAR SUPPORT â€” Nháº¯c lá»‹ch Ã¢m (FR-08)
-- ================================================================
-- LÃ½ do cáº§n: báº£ng reminders Ä‘Ã£ cÃ³ lunar_month / lunar_day nhÆ°ng
-- khÃ´ng cÃ³ cÆ¡ cháº¿ mapping Ã¢m â†’ dÆ°Æ¡ng Ä‘á»ƒ cron query Ä‘Ãºng.
-- Giáº£i phÃ¡p: báº£ng lunar_to_solar_map lÆ°u mapping 10 nÄƒm tá»›i,
-- Ä‘Æ°á»£c populate bá»Ÿi backend (Node.js / Python) khi deploy.
-- Cron chá»‰ cáº§n JOIN báº£ng nÃ y thay vÃ¬ tÃ­nh toÃ¡n phá»©c táº¡p trong SQL.
-- ----------------------------------------------------------------

CREATE TABLE lunar_to_solar_map (
    map_id          SERIAL          PRIMARY KEY,

    -- NgÃ y Ã¢m lá»‹ch
    lunar_year      SMALLINT        NOT NULL,
    lunar_month     SMALLINT        NOT NULL CHECK (lunar_month BETWEEN 1 AND 13), -- 13 = thÃ¡ng nhuáº­n
    lunar_day       SMALLINT        NOT NULL CHECK (lunar_day   BETWEEN 1 AND 30),
    is_leap_month   BOOLEAN         NOT NULL DEFAULT FALSE,  -- ThÃ¡ng nhuáº­n

    -- NgÃ y dÆ°Æ¡ng lá»‹ch tÆ°Æ¡ng á»©ng
    solar_date      DATE            NOT NULL,

    UNIQUE (lunar_year, lunar_month, lunar_day, is_leap_month)
);

CREATE INDEX idx_lunar_solar_date   ON lunar_to_solar_map(solar_date);
CREATE INDEX idx_lunar_month_day    ON lunar_to_solar_map(lunar_month, lunar_day);

-- ----------------------------------------------------------------
-- View Ä‘á»ƒ cron query reminders cáº§n nháº¯c hÃ´m nay (cáº£ dÆ°Æ¡ng láº«n Ã¢m)
-- Cron gá»i: SELECT * FROM vw_reminders_due_today;
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW vw_reminders_due_today AS
SELECT
    r.reminder_id,
    r.user_id,
    r.plot_id,
    r.title,
    r.description,
    r.reminder_type,
    r.notify_days_before,
    r.last_sent_year,
    'solar'     AS calendar_type,
    -- NgÃ y thá»±c sá»± sáº½ nháº¯c (dÆ°Æ¡ng lá»‹ch)
    MAKE_DATE(EXTRACT(YEAR FROM NOW())::INT, r.remind_month, r.remind_day) AS target_date
FROM  reminders r
WHERE r.is_active  = TRUE
  AND r.is_deleted = FALSE
  AND r.is_recurring = TRUE
  -- ChÆ°a gá»­i nÄƒm nay
  AND (r.last_sent_year IS NULL OR r.last_sent_year < EXTRACT(YEAR FROM NOW()))
  -- Trong khoáº£ng nháº¯c trÆ°á»›c N ngÃ y
  AND MAKE_DATE(EXTRACT(YEAR FROM NOW())::INT, r.remind_month, r.remind_day)
      BETWEEN CURRENT_DATE AND CURRENT_DATE + (r.notify_days_before || ' days')::INTERVAL

UNION ALL

-- Reminder theo Ã¢m lá»‹ch (join qua báº£ng mapping)
SELECT
    r.reminder_id,
    r.user_id,
    r.plot_id,
    r.title,
    r.description,
    r.reminder_type,
    r.notify_days_before,
    r.last_sent_year,
    'lunar'     AS calendar_type,
    lm.solar_date AS target_date
FROM  reminders r
JOIN  lunar_to_solar_map lm
      ON  lm.lunar_month   = r.lunar_month
      AND lm.lunar_day     = r.lunar_day
      AND lm.is_leap_month = r.is_leap_month   -- PhÃ¢n biá»‡t thÃ¡ng nhuáº­n vs thÃ¡ng thÆ°á»ng
      AND lm.lunar_year    = EXTRACT(YEAR FROM NOW())::INT
WHERE r.is_active    = TRUE
  AND r.is_deleted   = FALSE
  AND r.is_recurring = TRUE
  AND r.lunar_month IS NOT NULL
  AND r.lunar_day   IS NOT NULL
  AND (r.last_sent_year IS NULL OR r.last_sent_year < EXTRACT(YEAR FROM NOW()))
  AND lm.solar_date
      BETWEEN CURRENT_DATE AND CURRENT_DATE + (r.notify_days_before || ' days')::INTERVAL;

-- Reminder 1 láº§n (specific_date, khÃ´ng láº·p)
CREATE OR REPLACE VIEW vw_reminders_oneshot_due AS
SELECT
    r.reminder_id,
    r.user_id,
    r.plot_id,
    r.title,
    r.description,
    r.reminder_type,
    r.notify_days_before,
    r.specific_date AS target_date
FROM  reminders r
WHERE r.is_active    = TRUE
  AND r.is_deleted   = FALSE
  AND r.is_recurring = FALSE
  AND r.last_sent_at IS NULL   -- ChÆ°a gá»­i láº§n nÃ o
  AND r.specific_date
      BETWEEN CURRENT_DATE AND CURRENT_DATE + (r.notify_days_before || ' days')::INTERVAL;

-- ================================================================
-- PATCH 3: FIX SEED â€” Cáº­p nháº­t password hash thÃ nh bcrypt tháº­t
-- ================================================================
-- CÃ¡c hash dÆ°á»›i Ä‘Ã¢y Ä‘Æ°á»£c táº¡o báº±ng bcrypt(password, 10 rounds):
--   admin@cemetery.vn    â†’ password: 123456
--   admin2@cemetery.vn   â†’ password: 123456
--   khachhang1..4        â†’ password: 123456
--
-- QUAN TRá»ŒNG: ÄÃ¢y lÃ  hash cho mÃ´i trÆ°á»ng DEV/demo.
-- TrÆ°á»›c khi lÃªn production, Ä‘á»•i password táº¥t cáº£ tÃ i khoáº£n.
-- ----------------------------------------------------------------

UPDATE users SET password_hash = '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu'
WHERE email = 'admin@cemetery.vn';
-- password: 123456

UPDATE users SET password_hash = '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu'
WHERE email = 'admin2@cemetery.vn';
-- password: 123456

UPDATE users SET password_hash = '$2b$10$t3Ao4Uzec0esRbxHdXQIJO1RpZCDhcx9LrnlyoRg4QFzsTHzn5ubu'
WHERE email IN (
    'khachhang1@gmail.com',
    'khachhang2@gmail.com',
    'khachhang3@gmail.com',
    'khachhang4@gmail.com'
);
-- password: 123456

-- ================================================================
-- PATCH 4: INDEX Bá»” SUNG â€” Tá»‘i Æ°u query thÆ°á»ng gáº·p
-- ================================================================

-- TÃ¬m refresh token cÃ²n háº¡n theo user (dÃ¹ng khi kiá»ƒm tra session)
CREATE INDEX idx_rt_valid ON refresh_tokens(user_id, token_hash)
    WHERE is_revoked = FALSE;

-- TÃ¬m reminders cáº§n nháº¯c trong thÃ¡ng (cron dÃ¹ng)
CREATE INDEX idx_rem_lunar ON reminders(lunar_month, lunar_day)
    WHERE is_active = TRUE AND is_deleted = FALSE AND lunar_month IS NOT NULL;

-- ================================================================
-- CRON JOB Bá»” SUNG (ghi chÃº cho backend developer)
-- ================================================================
--
-- ThÃªm vÃ o node-cron:
--
-- 1. Má»—i ngÃ y 00:01 â€” dá»n token háº¿t háº¡n (nháº¹, cháº¡y Ä‘Ãªm)
--    SELECT fn_cleanup_expired_tokens();
--
-- 2. Má»—i nÄƒm 1 láº§n (VD: 01/01) â€” populate lunar_to_solar_map cho nÄƒm má»›i
--    â†’ DÃ¹ng thÆ° viá»‡n Node.js: npm install @nghiaca/lunar-calendar
--    â†’ Hoáº·c: npm install lunar-javascript
--    â†’ Generate toÃ n bá»™ ngÃ y Ã¢m nÄƒm má»›i â†’ INSERT INTO lunar_to_solar_map
--    â†’ Script máº«u: /scripts/generate_lunar_map.js (táº¡o riÃªng)
--
-- 3. Má»—i ngÃ y 07:00 â€” nháº¯c lá»‹ch (giá»¯ nguyÃªn tá»« v2.3, thay query báº±ng view)
--    SELECT * FROM vw_reminders_due_today;
--    SELECT * FROM vw_reminders_oneshot_due;
--    â†’ Gá»­i notification + email â†’ UPDATE reminders SET last_sent_at = NOW(),
--      last_sent_year = EXTRACT(YEAR FROM NOW()) WHERE reminder_id = ?
--
-- BACKEND NOTE â€” fn_auto_create_ownership (Fix 3):
--   Trigger tá»± Ä‘á»™ng táº¡o ownership_records khi contract status â†’ 'active'.
--   Vá»›i multi-plot (FR-04): trigger cháº¡y N láº§n cho N contracts â€” OK vá» máº·t logic.
--   Tuy nhiÃªn deceased_name, deceased_dob KHÃ”NG Ä‘Æ°á»£c copy tá»± Ä‘á»™ng tá»« reservation_requests.
--   â†’ Backend pháº£i tá»± UPDATE ownership_records sau khi táº¡o contract batch, hoáº·c
--     truyá»n thÃªm thÃ´ng tin vÃ o contracts.notes táº¡m thá»i rá»“i trigger Ä‘á»c tá»« Ä‘Ã³.
--   â†’ Æ¯u tiÃªn: backend gá»i riÃªng UPDATE ownership_records SET deceased_name = ?,
--     deceased_dob = ? WHERE contract_id = ? ngay sau khi táº¡o contract.
--
-- BACKEND API Bá»” SUNG:
--   POST /auth/refresh          â†’ Kiá»ƒm tra refresh_token (query by token_hash)
--   POST /auth/logout           â†’ UPDATE refresh_tokens SET is_revoked = TRUE
--   POST /auth/logout-all       â†’ Revoke táº¥t cáº£ token cá»§a user
--   GET  /auth/sessions         â†’ Danh sÃ¡ch session Ä‘ang hoáº¡t Ä‘á»™ng (admin / user tá»± xem)
--
-- ================================================================

