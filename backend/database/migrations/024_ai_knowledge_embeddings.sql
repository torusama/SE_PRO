-- Semantic retrieval for validated AI knowledge/memory.
-- The migration is intentionally fail-soft when pgvector is unavailable: the
-- application will keep using the existing SQL retrieval path instead of
-- taking the primary chat workflow down.

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file THEN
      RAISE NOTICE 'pgvector is unavailable; semantic RAG will use SQL fallback';
  END;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE 'ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedding VECTOR(1536)';
    EXECUTE 'ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100)';
    EXECUTE 'ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ';

    -- Keep the vector index restricted to records that are safe to retrieve.
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_knowledge_embedding
        ON ai_knowledge_entries
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        WHERE is_active = TRUE
          AND validation_status = ''active''
          AND embedding IS NOT NULL';
    EXCEPTION
      WHEN feature_not_supported OR object_not_in_prerequisite_state THEN
        RAISE NOTICE 'ivfflat index could not be created yet; exact vector search remains available';
    END;
  END IF;
END $$;
