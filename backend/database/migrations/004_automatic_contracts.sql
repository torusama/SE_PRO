-- Luu noi dung hop dong tai thoi diem phat sinh de bao dam lich su khong bi
-- thay doi khi ho so nguoi dung/lo phan mo duoc cap nhat sau nay.
ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS contract_content TEXT,
    ADD COLUMN IF NOT EXISTS inheritance_content TEXT,
    ADD COLUMN IF NOT EXISTS inheritance_updated_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS inheritance_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_request_plot
    ON contracts(request_id, plot_id)
    WHERE request_id IS NOT NULL AND is_deleted = FALSE;
