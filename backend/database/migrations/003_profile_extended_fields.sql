-- Extended personal-profile fields for the customer "Profile" page.
-- Previously these were hard-coded / mocked on the frontend; this migration
-- gives them real columns so they can be read from and written to the DB.
-- Apply after backend/database/DBase.sql and 002_offline_appointments.sql.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS nationality               VARCHAR(100),
    ADD COLUMN IF NOT EXISTS city                       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code                VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_name      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_relation  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_email     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS notes                       TEXT,
    ADD COLUMN IF NOT EXISTS notify_payment              BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_service              BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_anniversary          BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_announcement         BOOLEAN NOT NULL DEFAULT FALSE;

-- Nothing is backfilled: existing rows simply get NULL / the boolean defaults
-- above, which is exactly the "empty until the user fills the profile form"
-- behaviour requested (no mock/sample values in the database either).
