-- Keep transfer/inheritance contracts compatible when they are activated
-- before a contract_plots row is inserted. Purchase contracts use all rows in
-- contract_plots; legacy/single-plot workflows fall back to contracts.plot_id.

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
            contract_plot.plot_id,
            NEW.user_id,
            COALESCE(NEW.effective_date, NEW.contract_date),
            TRUE,
            NEW.ownership_source
        FROM (
            SELECT cp.plot_id
            FROM contract_plots cp
            WHERE cp.contract_id = NEW.contract_id
            UNION ALL
            SELECT NEW.plot_id
            WHERE NOT EXISTS (
                SELECT 1 FROM contract_plots cp
                WHERE cp.contract_id = NEW.contract_id
            )
        ) contract_plot
        ON CONFLICT DO NOTHING;

        UPDATE plots
        SET status = 'sold',
            reserved_until = NULL,
            updated_at = NOW()
        WHERE plot_id IN (
            SELECT cp.plot_id
            FROM contract_plots cp
            WHERE cp.contract_id = NEW.contract_id
            UNION ALL
            SELECT NEW.plot_id
            WHERE NOT EXISTS (
                SELECT 1 FROM contract_plots cp
                WHERE cp.contract_id = NEW.contract_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
