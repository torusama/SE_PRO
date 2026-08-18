-- Transfer request workflow: extend reservation_requests to support transfers.
-- Reuses request_plots, offline_appointments, contracts, contract_plots,
-- payment_transactions, and contract_signed_evidence.

-- ---------------------------------------------------------------------------
-- 1. Allow 'transfer' value in request_type (overrides trigger from 034)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_purchase_request_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_type NOT IN ('purchase', 'transfer') THEN
    RAISE EXCEPTION 'Only purchase and transfer request types are supported'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing CHECK constraints on request_type column (may be unnamed)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'reservation_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%request_type%'
  LOOP
    EXECUTE 'ALTER TABLE reservation_requests DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE reservation_requests
  ADD CONSTRAINT reservation_requests_request_type_check
  CHECK (request_type IN ('purchase', 'transfer', 'reserve'));

-- ---------------------------------------------------------------------------
-- 2. Add 'completed' to allowed status values
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'reservation_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
      AND pg_get_constraintdef(oid) NOT LIKE '%request_type%'
  LOOP
    EXECUTE 'ALTER TABLE reservation_requests DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE reservation_requests
  ADD CONSTRAINT reservation_requests_status_check
  CHECK (status IN ('pending','submitted','approved','rejected','cancelled','completed'));

-- ---------------------------------------------------------------------------
-- 3. Add transfer_type column to reservation_requests
-- ---------------------------------------------------------------------------

ALTER TABLE reservation_requests
  ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20)
  CHECK (transfer_type IS NULL OR transfer_type IN ('sale', 'inheritance', 'gift'));

-- ---------------------------------------------------------------------------
-- 4. Transfer request details — 1:1 extension for recipient info
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transfer_request_details (
    request_id          INT PRIMARY KEY REFERENCES reservation_requests(request_id) ON DELETE CASCADE,
    recipient_full_name     VARCHAR(150) NOT NULL,
    recipient_id_card       VARCHAR(50) NOT NULL,
    recipient_phone         VARCHAR(30) NOT NULL,
    recipient_email         VARCHAR(255),
    recipient_address       TEXT,
    recipient_date_of_birth DATE,
    recipient_relationship  VARCHAR(100),
    transaction_amount      DECIMAL(15,2),
    payment_method          VARCHAR(50),
    agreement_note          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. Customer-uploaded supporting documents for transfers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transfer_request_documents (
    document_id         SERIAL PRIMARY KEY,
    request_id          INT NOT NULL REFERENCES reservation_requests(request_id) ON DELETE CASCADE,
    stored_filename     VARCHAR(255) NOT NULL UNIQUE,
    original_filename   VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    size_bytes          BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum_sha256     CHAR(64) NOT NULL,
    uploaded_by         INT NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_request_docs_request
    ON transfer_request_documents(request_id);
