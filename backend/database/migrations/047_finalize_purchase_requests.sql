-- A purchase request is terminal after ownership activation.
-- Do not derive this from the current contract status: an old purchase
-- contract becomes `transferred` when its plot is transferred later.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'reservation_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) NOT LIKE '%request_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE reservation_requests DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;

  ALTER TABLE reservation_requests
    ADD CONSTRAINT reservation_requests_status_check
    CHECK (status IN ('draft', 'pending', 'submitted', 'approved', 'rejected', 'cancelled', 'completed'));
END $$;

-- Repair purchase requests that already reached ownership activation before
-- the application started persisting the terminal request state. This covers
-- both still-active purchases and purchases whose contract was later
-- transferred, while leaving draft/approved-but-not-activated requests alone.
UPDATE reservation_requests rr
SET status = 'completed', updated_at = NOW()
WHERE rr.request_type = 'purchase'
  AND rr.status = 'approved'
  AND EXISTS (
    SELECT 1
    FROM contracts c
    WHERE c.request_id = rr.request_id
      AND c.is_deleted = FALSE
      AND c.ownership_source = 'purchase'
      AND c.status IN ('active', 'transferred')
  );
