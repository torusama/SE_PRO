-- Purchase approval creates a draft contract and only reserves its plots.
-- Completing the offline signing appointment activates the contract; this
-- trigger then creates ownership and marks the plot as sold.

ALTER TABLE contracts
    DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE contracts
    ADD CONSTRAINT contracts_status_check
    CHECK (status IN ('draft', 'active', 'expired', 'transferred', 'cancelled'));

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
        ) VALUES (
            NEW.contract_id,
            NEW.plot_id,
            NEW.user_id,
            COALESCE(NEW.effective_date, NEW.contract_date),
            TRUE,
            NEW.ownership_source
        )
        ON CONFLICT DO NOTHING;

        UPDATE plots
        SET status = 'sold',
            reserved_until = NULL,
            updated_at = NOW()
        WHERE plot_id = NEW.plot_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_create_ownership ON contracts;

CREATE TRIGGER trg_contract_create_ownership
    AFTER INSERT OR UPDATE OF status ON contracts
    FOR EACH ROW EXECUTE FUNCTION fn_auto_create_ownership();
