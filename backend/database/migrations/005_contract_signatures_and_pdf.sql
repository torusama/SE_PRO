ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS party_a_signed_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS party_a_signature_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS party_a_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS party_a_signature_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS party_b_signed_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS party_b_signature_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS party_b_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS party_b_signature_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS pdf_uploaded_by INT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMPTZ;
