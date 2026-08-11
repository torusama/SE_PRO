-- New plot requests are purchase-only. Historical hold rows remain readable
-- and can still have their status updated for operational cleanup.
CREATE OR REPLACE FUNCTION fn_enforce_purchase_request_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_type <> 'purchase' THEN
    RAISE EXCEPTION 'Plot requests only support the purchase type'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_purchase_request_type
  ON reservation_requests;

CREATE TRIGGER trg_enforce_purchase_request_type
BEFORE INSERT OR UPDATE OF request_type ON reservation_requests
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_purchase_request_type();
