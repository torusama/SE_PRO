-- AI runtime observability and customer-to-admin proposal workflow.
-- Customer proposals are deliberately separated from ai_knowledge_entries:
-- accepting a price/website/business suggestion must never make it active RAG
-- knowledge automatically.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_llm_calls (
  llm_call_id            BIGSERIAL PRIMARY KEY,
  routing_key            VARCHAR(180),
  provider_id            VARCHAR(50) NOT NULL,
  provider_name          VARCHAR(180) NOT NULL,
  model                  VARCHAR(180) NOT NULL,
  status                 VARCHAR(20) NOT NULL,
  prompt_tokens          INT,
  completion_tokens      INT,
  total_tokens           INT,
  estimated_cost_usd     NUMERIC(16, 8),
  latency_ms             INT NOT NULL,
  error_type             VARCHAR(100),
  error_message          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_ai_llm_calls_status CHECK (status IN ('success', 'failed')),
  CONSTRAINT ck_ai_llm_calls_token_counts CHECK (
    (prompt_tokens IS NULL OR prompt_tokens >= 0) AND
    (completion_tokens IS NULL OR completion_tokens >= 0) AND
    (total_tokens IS NULL OR total_tokens >= 0)
  ),
  CONSTRAINT ck_ai_llm_calls_latency CHECK (latency_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_calls_created_at
  ON ai_llm_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_llm_calls_status_created
  ON ai_llm_calls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_llm_calls_model_created
  ON ai_llm_calls(provider_id, model, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_customer_proposals (
  proposal_id            BIGSERIAL PRIMARY KEY,
  conversation_id        BIGINT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
  source_message_id      BIGINT REFERENCES ai_messages(message_id) ON DELETE SET NULL,
  user_id                INT REFERENCES users(user_id) ON DELETE SET NULL,
  proposal_type          VARCHAR(40) NOT NULL,
  subject                VARCHAR(220) NOT NULL,
  content                TEXT NOT NULL,
  selected_plot_code     VARCHAR(80),
  service_name           VARCHAR(220),
  proposed_amount_vnd    NUMERIC(15, 2),
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
  review_note            TEXT,
  reviewed_by            INT REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_ai_customer_proposals_type CHECK (
    proposal_type IN (
      'price_negotiation',
      'website_suggestion',
      'service_suggestion',
      'plot_feedback',
      'policy_suggestion',
      'complaint',
      'other'
    )
  ),
  CONSTRAINT ck_ai_customer_proposals_status CHECK (
    status IN ('pending', 'accepted', 'rejected')
  ),
  CONSTRAINT ck_ai_customer_proposals_amount CHECK (
    proposed_amount_vnd IS NULL OR proposed_amount_vnd >= 0
  )
);

-- One user turn creates at most one structured admin proposal. This also makes
-- client retries idempotent after the user message has already been persisted.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_customer_proposals_source_message
  ON ai_customer_proposals(source_message_id)
  WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_customer_proposals_status_created
  ON ai_customer_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_customer_proposals_user_created
  ON ai_customer_proposals(user_id, created_at DESC);

COMMIT;
