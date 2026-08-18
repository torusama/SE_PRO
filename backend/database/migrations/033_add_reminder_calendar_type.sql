ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS calendar_type VARCHAR(10) NOT NULL DEFAULT 'solar';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_reminders_calendar_type'
      AND conrelid = 'reminders'::regclass
  ) THEN
    ALTER TABLE reminders
      ADD CONSTRAINT chk_reminders_calendar_type
      CHECK (calendar_type IN ('solar', 'lunar'));
  END IF;
END $$;
