BEGIN;

-- A conversation correction is retrievable only for its authenticated owner.
-- It is contextual guidance, not authoritative global business knowledge.
ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_entries_type;
ALTER TABLE ai_knowledge_entries
  ADD CONSTRAINT ck_ai_knowledge_entries_type
  CHECK (knowledge_type IN (
    'user_preference',
    'business_rule',
    'faq',
    'information_correction',
    'conversation_correction'
  ));

ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_user_is_preference;
ALTER TABLE ai_knowledge_entries
  ADD CONSTRAINT ck_ai_knowledge_user_is_preference
  CHECK (
    scope <> 'user'
    OR knowledge_type IN ('user_preference', 'conversation_correction')
  );

ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ck_ai_knowledge_user_has_memory_key;
ALTER TABLE ai_knowledge_entries
  ADD CONSTRAINT ck_ai_knowledge_user_has_memory_key
  CHECK (
    scope <> 'user'
    OR knowledge_type <> 'user_preference'
    OR memory_key IS NOT NULL
  );

-- Negotiated prices are admin-review feedback. They must never be activated as
-- KB entries or mutate the authoritative inventory price through this queue.
ALTER TABLE ai_feedback
  DROP CONSTRAINT IF EXISTS ai_feedback_feedback_type_check;
ALTER TABLE ai_feedback
  ADD CONSTRAINT ai_feedback_feedback_type_check
  CHECK (feedback_type IN (
    'helpful',
    'bad_recommendation',
    'wrong_information',
    'irrelevant_answer',
    'price_proposal',
    'other'
  ));

COMMIT;
