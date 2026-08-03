-- Archived contract PDF uploads and electronic signatures are no longer part
-- of the contract workflow. Generated PDFs and signed-image evidence remain.

ALTER TABLE contracts
    DROP COLUMN IF EXISTS pdf_url,
    DROP COLUMN IF EXISTS pdf_uploaded_by,
    DROP COLUMN IF EXISTS pdf_uploaded_at,
    DROP COLUMN IF EXISTS party_a_signed_by,
    DROP COLUMN IF EXISTS party_a_signature_name,
    DROP COLUMN IF EXISTS party_a_signed_at,
    DROP COLUMN IF EXISTS party_a_signature_hash,
    DROP COLUMN IF EXISTS party_b_signed_by,
    DROP COLUMN IF EXISTS party_b_signature_name,
    DROP COLUMN IF EXISTS party_b_signed_at,
    DROP COLUMN IF EXISTS party_b_signature_hash;
