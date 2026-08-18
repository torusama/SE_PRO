-- One purchase request produces one contract that may cover multiple plots.
-- Signed offline evidence is private and ownership is activated explicitly.

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS contract_base_content TEXT;

CREATE TABLE IF NOT EXISTS contract_plots (
    contract_id  INT NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    plot_id      INT NOT NULL REFERENCES plots(plot_id),
    agreed_price DECIMAL(15,2) NOT NULL CHECK (agreed_price >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contract_id, plot_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_plots_plot
    ON contract_plots(plot_id);

INSERT INTO contract_plots (contract_id, plot_id, agreed_price)
SELECT contract_id, plot_id, total_amount
FROM contracts
ON CONFLICT (contract_id, plot_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS contract_signed_evidence (
    evidence_id      SERIAL PRIMARY KEY,
    contract_id      INT NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    stored_filename  VARCHAR(255) NOT NULL UNIQUE,
    original_name    VARCHAR(255) NOT NULL,
    mime_type        VARCHAR(100) NOT NULL
                     CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes       INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    uploaded_by      INT NOT NULL REFERENCES users(user_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_signed_evidence_contract
    ON contract_signed_evidence(contract_id, created_at);

CREATE OR REPLACE FUNCTION fn_auto_create_ownership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
        INSERT INTO ownership_records (
            contract_id,
            plot_id,
            user_id,
            ownership_start,
            is_current,
            source
        )
        SELECT
            NEW.contract_id,
            cp.plot_id,
            NEW.user_id,
            COALESCE(NEW.effective_date, NEW.contract_date),
            TRUE,
            NEW.ownership_source
        FROM contract_plots cp
        WHERE cp.contract_id = NEW.contract_id
        ON CONFLICT DO NOTHING;

        UPDATE plots
        SET status = 'sold',
            reserved_until = NULL,
            updated_at = NOW()
        WHERE plot_id IN (
            SELECT plot_id
            FROM contract_plots
            WHERE contract_id = NEW.contract_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_create_ownership ON contracts;

CREATE TRIGGER trg_contract_create_ownership
    AFTER INSERT OR UPDATE OF status ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_auto_create_ownership();
