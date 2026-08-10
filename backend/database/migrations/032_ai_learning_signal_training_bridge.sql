BEGIN;

-- A complete pairwise recommendation signal is materialized as exactly two
-- PlotRanker rows: selected=1 and rejected=0. Keep that bridge idempotent even
-- if an administrator retries the retrain action or two requests overlap.
WITH duplicate_samples AS (
  SELECT sample_id,
         ROW_NUMBER() OVER (
           PARTITION BY source_signal_id, (label->>'label_selected')
           ORDER BY sample_id ASC
         ) AS duplicate_rank
  FROM ai_training_samples
  WHERE source_signal_id IS NOT NULL
    AND label ? 'label_selected'
)
DELETE FROM ai_training_samples sample
USING duplicate_samples duplicate
WHERE sample.sample_id = duplicate.sample_id
  AND duplicate.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_training_sample_signal_label
  ON ai_training_samples(source_signal_id, ((label->>'label_selected')))
  WHERE source_signal_id IS NOT NULL
    AND label ? 'label_selected';

COMMIT;
