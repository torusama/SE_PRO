BEGIN;

-- Conversational misunderstandings also emit analytics-only signals; they can
-- never become ranker training samples through the training-ready constraint.
ALTER TABLE ai_learning_signals
  DROP CONSTRAINT IF EXISTS ai_learning_signals_signal_type_check;

ALTER TABLE ai_learning_signals
  ADD CONSTRAINT ai_learning_signals_signal_type_check
  CHECK (
    signal_type IN (
      'recommendation_feedback',
      'conversation_correction',
      'legacy_implicit_preference'
    )
  );

COMMIT;
