-- New signed-contract evidence uploads are restricted to PDF and Word files.
-- Existing legacy image evidence remains readable and is not deleted.

ALTER TABLE contract_signed_evidence
    DROP CONSTRAINT IF EXISTS contract_signed_evidence_mime_type_check;

ALTER TABLE contract_signed_evidence
    ADD CONSTRAINT contract_signed_evidence_mime_type_check
    CHECK (mime_type IN (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )) NOT VALID;
