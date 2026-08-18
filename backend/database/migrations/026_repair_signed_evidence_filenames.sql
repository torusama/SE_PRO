DO $$
DECLARE
  evidence RECORD;
  repaired_name TEXT;
BEGIN
  FOR evidence IN
    SELECT evidence_id, original_name
    FROM contract_signed_evidence
    WHERE original_name ~ ('[' || chr(128) || '-' || chr(159) || ']')
  LOOP
    BEGIN
      repaired_name := convert_from(
        convert_to(evidence.original_name, 'LATIN1'),
        'UTF8'
      );

      IF repaired_name <> evidence.original_name THEN
        UPDATE contract_signed_evidence
        SET original_name = repaired_name
        WHERE evidence_id = evidence.evidence_id;
      END IF;
    EXCEPTION
      WHEN character_not_in_repertoire OR untranslatable_character THEN
        NULL;
    END;
  END LOOP;
END $$;
