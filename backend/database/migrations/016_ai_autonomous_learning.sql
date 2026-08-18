-- Memory-Augmented AI Agent with Verified Knowledge and Adaptive Recommendation Signals.
-- The external foundation LLM is never retrained by this migration or application flow.
-- Apply after 015_ai_agent_learning.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- Verified knowledge and isolated persistent user memory
-- ---------------------------------------------------------------------------

ALTER TABLE ai_knowledge_entries
  ADD COLUMN IF NOT EXISTS knowledge_type VARCHAR(40) NOT NULL DEFAULT 'faq',
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS memory_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS validation_status VARCHAR(30) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS validation_reason TEXT,
  ADD COLUMN IF NOT EXISTS validation_evidence JSONB,
  ADD COLUMN IF NOT EXISTS source_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_conversation_id BIGINT
    REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_message_id BIGINT
    REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS supersedes_entry_id BIGINT
    REFERENCES ai_knowledge_entries(knowledge_entry_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;

-- Legacy seeded knowledge has a stable key. New memory/knowledge proposals use
-- scope-aware hashes and may leave knowledge_key NULL.
ALTER TABLE ai_knowledge_entries
  ALTER COLUMN knowledge_key DROP NOT NULL;

-- 015 now names this unique index explicitly. Drop the default constraint name
-- as well when upgrading a database that ran the earlier inline-UNIQUE draft.
ALTER TABLE ai_knowledge_entries
  DROP CONSTRAINT IF EXISTS ai_knowledge_entries_knowledge_key_key;
DROP INDEX IF EXISTS uq_ai_knowledge_entries_key;
CREATE UNIQUE INDEX uq_ai_knowledge_entries_key
  ON ai_knowledge_entries(knowledge_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_entries_type'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_entries_type
      CHECK (knowledge_type IN (
        'user_preference',
        'business_rule',
        'faq',
        'information_correction'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_entries_scope'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_entries_scope
      CHECK (scope IN ('global', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_entries_validation_status'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_entries_validation_status
      CHECK (validation_status IN (
        'proposed',
        'validating',
        'active',
        'quarantined',
        'rejected',
        'superseded'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_user_has_owner'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_user_has_owner
      CHECK (scope <> 'user' OR owner_user_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_user_is_preference'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_user_is_preference
      CHECK (scope <> 'user' OR knowledge_type = 'user_preference');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_user_has_memory_key'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_user_has_memory_key
      CHECK (scope <> 'user' OR memory_key IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_global_has_no_owner'
  ) THEN
    ALTER TABLE ai_knowledge_entries
      ADD CONSTRAINT ck_ai_knowledge_global_has_no_owner
      CHECK (scope <> 'global' OR owner_user_id IS NULL);
  END IF;
END $$;

DROP INDEX IF EXISTS uq_ai_knowledge_global_hash;
DROP INDEX IF EXISTS uq_ai_knowledge_user_hash;

-- One active value per replaceable preference key and user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_knowledge_user_active_key
  ON ai_knowledge_entries(owner_user_id, memory_key)
  WHERE scope = 'user'
    AND owner_user_id IS NOT NULL
    AND memory_key IS NOT NULL
    AND is_active = TRUE
    AND validation_status = 'active';

-- Effective date windows can overlap during a scheduled hand-off, so global
-- keys are indexed but conflict resolution remains transactional in the service.
DROP INDEX IF EXISTS uq_ai_knowledge_global_active_key;
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_global_active_key
  ON ai_knowledge_entries(knowledge_type, memory_key)
  WHERE scope = 'global'
    AND memory_key IS NOT NULL
    AND is_active = TRUE
    AND validation_status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_user_retrieval
  ON ai_knowledge_entries(owner_user_id, memory_key, updated_at DESC)
  WHERE scope = 'user'
    AND is_active = TRUE
    AND validation_status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_global_retrieval
  ON ai_knowledge_entries(knowledge_type, category, updated_at DESC)
  WHERE scope = 'global'
    AND is_active = TRUE
    AND validation_status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_content_hash
  ON ai_knowledge_entries(scope, content_hash);

-- ---------------------------------------------------------------------------
-- Knowledge version history
-- ---------------------------------------------------------------------------

ALTER TABLE ai_knowledge_versions
  ADD COLUMN IF NOT EXISTS version_number INT,
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS source_message_id BIGINT
    REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS validation_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_knowledge_versions_action'
  ) THEN
    ALTER TABLE ai_knowledge_versions
      ADD CONSTRAINT ck_ai_knowledge_versions_action
      CHECK (
        action_type IS NULL OR action_type IN (
          'created',
          'activated',
          'quarantined',
          'rejected',
          'superseded',
          'restored'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_versions_entry
  ON ai_knowledge_versions(entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Actual recommendation execution traces
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_recommendation_runs (
  recommendation_run_id       VARCHAR(100) PRIMARY KEY,
  user_id                     INT REFERENCES users(user_id) ON DELETE SET NULL,
  conversation_id             BIGINT
    REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  source_message_id           BIGINT
    REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  requirement_snapshot        JSONB NOT NULL,
  candidate_option_ids        JSONB NOT NULL,
  feature_snapshot            JSONB NOT NULL,
  deterministic_ranking       JSONB NOT NULL,
  ml_ranking                  JSONB,
  final_ranking               JSONB NOT NULL,
  model_version               VARCHAR(100) NOT NULL,
  ranker_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_reason             VARCHAR(100),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendation_runs_conversation
  ON ai_recommendation_runs(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recommendation_runs_user
  ON ai_recommendation_runs(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Recommendation learning signals (never factual knowledge)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_learning_signals (
  signal_id                    BIGSERIAL PRIMARY KEY,
  user_id                      INT REFERENCES users(user_id) ON DELETE SET NULL,
  conversation_id              BIGINT
    REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  source_message_id            BIGINT
    REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  recommendation_run_id        VARCHAR(100),
  signal_type                  VARCHAR(50) NOT NULL,
  selected_option_id           VARCHAR(100),
  rejected_option_id           VARCHAR(100),
  explanation                  TEXT,
  feature_snapshot             JSONB,
  user_requirement_snapshot    JSONB,
  model_version                VARCHAR(100),
  training_ready               BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_reason             TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at                  TIMESTAMPTZ,
  consumed_by_training_run_id  BIGINT
    REFERENCES ai_training_runs(run_id) ON DELETE SET NULL
);

ALTER TABLE ai_learning_signals
  ADD COLUMN IF NOT EXISTS source_message_id BIGINT
    REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommendation_run_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS selected_option_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rejected_option_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS feature_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS user_requirement_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(100),
  ADD COLUMN IF NOT EXISTS training_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS readiness_reason TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_by_training_run_id BIGINT
    REFERENCES ai_training_runs(run_id) ON DELETE SET NULL;

-- Upgrade the original autonomous-learning draft without losing its rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ai_learning_signals'
      AND column_name = 'message_id'
  ) THEN
    EXECUTE
      'UPDATE ai_learning_signals
       SET source_message_id = message_id
       WHERE source_message_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ai_learning_signals'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE ai_learning_signals ALTER COLUMN category DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ai_learning_signals'
      AND column_name = 'content'
  ) THEN
    ALTER TABLE ai_learning_signals ALTER COLUMN content DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE ai_learning_signals
  DROP CONSTRAINT IF EXISTS ai_learning_signals_signal_type_check;

UPDATE ai_learning_signals
SET signal_type = 'legacy_implicit_preference',
    training_ready = FALSE,
    readiness_reason = COALESCE(
      readiness_reason,
      'Legacy implicit profile retained for audit only; never used for training.'
    )
WHERE signal_type = 'implicit_preference';

ALTER TABLE ai_learning_signals
  ADD CONSTRAINT ai_learning_signals_signal_type_check
  CHECK (
    signal_type IN (
      'recommendation_feedback',
      'legacy_implicit_preference'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_ai_learning_signals_training_ready'
  ) THEN
    ALTER TABLE ai_learning_signals
      ADD CONSTRAINT ck_ai_learning_signals_training_ready
      CHECK (
        training_ready = FALSE
        OR (
          signal_type = 'recommendation_feedback'
          AND source_message_id IS NOT NULL
          AND recommendation_run_id IS NOT NULL
          AND selected_option_id IS NOT NULL
          AND rejected_option_id IS NOT NULL
          AND selected_option_id <> rejected_option_id
          AND feature_snapshot IS NOT NULL
          AND jsonb_typeof(feature_snapshot) = 'object'
          AND feature_snapshot <> '{}'::jsonb
          AND user_requirement_snapshot IS NOT NULL
          AND jsonb_typeof(user_requirement_snapshot) = 'object'
          AND user_requirement_snapshot <> '{}'::jsonb
          AND NULLIF(BTRIM(model_version), '') IS NOT NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ai_learning_signals_recommendation_run'
  ) THEN
    ALTER TABLE ai_learning_signals
      ADD CONSTRAINT fk_ai_learning_signals_recommendation_run
      FOREIGN KEY (recommendation_run_id)
      REFERENCES ai_recommendation_runs(recommendation_run_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_learning_signals_type
  ON ai_learning_signals(signal_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_signals_readiness
  ON ai_learning_signals(training_ready, consumed_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_learning_signal_source
  ON ai_learning_signals(source_message_id, signal_type)
  WHERE source_message_id IS NOT NULL;

-- Existing or future manually curated training samples must be explicitly
-- marked ready. Incomplete feedback-derived rows remain excluded.
ALTER TABLE ai_training_samples
  ADD COLUMN IF NOT EXISTS source_signal_id BIGINT
    REFERENCES ai_learning_signals(signal_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS training_ready BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_training_samples_ready
  ON ai_training_samples(is_approved, training_ready, sample_id);

COMMIT;
