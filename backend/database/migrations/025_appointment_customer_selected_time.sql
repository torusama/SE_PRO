ALTER TABLE offline_appointments
  ADD COLUMN IF NOT EXISTS customer_selected_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_offline_appointment_customer_selected_time'
  ) THEN
    ALTER TABLE offline_appointments
      ADD CONSTRAINT chk_offline_appointment_customer_selected_time
      CHECK (
        customer_selected_at IS NULL
        OR (
          customer_selected_at >= scheduled_at
          AND customer_selected_at <= scheduled_end_at
        )
      );
  END IF;
END $$;
