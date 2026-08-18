-- Switch semantic RAG from the previous 1536-dimension OpenAI-oriented
-- prototype to NVIDIA NIM BGE-M3 (1024 dimensions).
--
-- This migration deliberately clears old embeddings before changing the
-- vector size. Embeddings created by different models/dimensions must never be
-- mixed in the same similarity search. Active validated rows are re-embedded
-- safely by KnowledgeEmbeddingService after startup.

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file THEN
      RAISE NOTICE 'pgvector is unavailable; semantic RAG will use SQL fallback';
  END;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);
    ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);
    ALTER TABLE ai_knowledge_entries
      ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

    DROP INDEX IF EXISTS idx_ai_knowledge_embedding;

    -- Discard vectors produced by the previous embedding model. This USING
    -- clause also makes conversion from VECTOR(1536) -> VECTOR(1024) safe.
    ALTER TABLE ai_knowledge_entries
      ALTER COLUMN embedding TYPE VECTOR(1024)
      USING NULL::VECTOR(1024);

    UPDATE ai_knowledge_entries
       SET embedding_model = NULL,
           embedded_at = NULL
     WHERE embedding IS NULL;

    BEGIN
      CREATE INDEX IF NOT EXISTS idx_ai_knowledge_embedding
        ON ai_knowledge_entries
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        WHERE is_active = TRUE
          AND validation_status = 'active'
          AND embedding IS NOT NULL;
    EXCEPTION
      WHEN feature_not_supported OR object_not_in_prerequisite_state THEN
        RAISE NOTICE 'ivfflat index could not be created yet; exact vector search remains available';
    END;
  END IF;
END $$;
