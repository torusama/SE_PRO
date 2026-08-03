-- Existing contracts predate contract_base_content. Keep only Articles 1-5
-- as the stable base so the application can compose Article 6/7 dynamically.

UPDATE contracts
SET contract_base_content = BTRIM(
    REGEXP_REPLACE(
        contract_content,
        E'(\\r?\\n)+[[:space:]]*ĐIỀU[[:space:]]+6[[:space:]]*\\..*$',
        '',
        'is'
    )
)
WHERE (contract_base_content IS NULL OR BTRIM(contract_base_content) = '')
  AND contract_content IS NOT NULL
  AND BTRIM(contract_content) <> '';
