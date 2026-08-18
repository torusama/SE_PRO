ALTER TABLE offline_appointments
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_responded_at TIMESTAMPTZ;

UPDATE offline_appointments
SET scheduled_end_at = scheduled_at + INTERVAL '1 hour'
WHERE scheduled_end_at IS NULL;

UPDATE offline_appointments
SET customer_status = CASE
  WHEN status = 'scheduled' THEN 'pending'
  ELSE 'confirmed'
END
WHERE customer_status IS NULL;

ALTER TABLE offline_appointments
  ALTER COLUMN scheduled_end_at SET NOT NULL,
  ALTER COLUMN customer_status SET DEFAULT 'pending',
  ALTER COLUMN customer_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_offline_appointment_time_range'
  ) THEN
    ALTER TABLE offline_appointments
      ADD CONSTRAINT chk_offline_appointment_time_range
      CHECK (scheduled_end_at > scheduled_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_offline_appointment_customer_status'
  ) THEN
    ALTER TABLE offline_appointments
      ADD CONSTRAINT chk_offline_appointment_customer_status
      CHECK (customer_status IN ('pending', 'confirmed', 'declined'));
  END IF;
END $$;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS generated_pdf_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_pdf_by INTEGER REFERENCES users(user_id);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'payment_transactions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%payment_method%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE payment_transactions DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;

  ALTER TABLE payment_transactions
    ADD CONSTRAINT chk_payment_transactions_method
    CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'other'));
END $$;
