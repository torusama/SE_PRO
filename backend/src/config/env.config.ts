export const envConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL,
  migrations: {
    enabled: (process.env.DB_MIGRATIONS_ENABLED ?? 'true') === 'true',
    directory: process.env.DB_MIGRATIONS_DIR,
  },
  jwtSecret: process.env.JWT_SECRET ?? 'change_this_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  email: {
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      senderEmail: process.env.GMAIL_SENDER_EMAIL,
      timeoutMs: Number(process.env.GMAIL_API_TIMEOUT_MS) || 15000,
    },
  },
  sms: {
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
  },
  ai: {
    enableLlm: (process.env.AI_ENABLE_LLM ?? 'true') === 'true',
    fallbackRuleBased:
      (process.env.AI_FALLBACK_RULE_BASED ?? 'true') === 'true',
    maxToolRounds: Number(process.env.AI_MAX_TOOL_ROUNDS) || 4,
    maxHistoryMessages: Number(process.env.AI_MAX_HISTORY_MESSAGES) || 40,
    autoApplyVerifiedCorrections:
      (process.env.AI_AUTO_APPLY_VERIFIED_CORRECTIONS ?? 'false') === 'true',
    plotRankerEnabled:
      (process.env.AI_PLOT_RANKER_ENABLED ?? 'false') === 'true',
    retrainMinSamples: Number(process.env.AI_RETRAIN_MIN_SAMPLES) || 20,
    router: {
      totalTimeoutMs: Number(process.env.AI_LLM_TOTAL_TIMEOUT_MS) || 10000,
      providerTimeoutMs: Number(process.env.AI_LLM_PROVIDER_TIMEOUT_MS) || 6000,
      providerCooldownMs: Number(process.env.AI_LLM_PROVIDER_COOLDOWN_MS) || 0,
      transientKeyCooldownMs:
        Number(process.env.AI_LLM_TRANSIENT_KEY_COOLDOWN_MS) || 800,
      rotateProviders:
        (process.env.AI_LLM_ROTATE_PROVIDERS ?? 'false') === 'true',
    },
    rag: {
      enabled: (process.env.AI_RAG_ENABLED ?? 'true') === 'true',
      // Dedicated Llama embedding pool. Mistral reads a separate namespace.
      apiKey: process.env.AI_EMBEDDING_API_KEY,
      apiKeys: process.env.AI_EMBEDDING_API_KEYS,
      baseUrl:
        process.env.AI_EMBEDDING_API_BASE_URL ??
        process.env.NVIDIA_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      // Keep the configured embedding model at 1024 dimensions so it remains
      // compatible with the pgvector column created by the RAG migration.
      model:
        process.env.AI_EMBEDDING_MODEL ?? 'nvidia/llama-nemotron-embed-1b-v2',
      dimension: Number(process.env.AI_EMBEDDING_DIMENSION) || 1024,
      timeoutMs: Number(process.env.AI_EMBEDDING_TIMEOUT_MS) || 1000,
      totalTimeoutMs: Number(process.env.AI_EMBEDDING_TOTAL_TIMEOUT_MS) || 1400,
      maxAttempts: Number(process.env.AI_EMBEDDING_MAX_ATTEMPTS) || 2,
      keyCooldownMs: Number(process.env.AI_EMBEDDING_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.AI_EMBEDDING_INVALID_KEY_COOLDOWN_MS) || 600000,
      userLimit: Number(process.env.AI_RAG_USER_LIMIT) || 8,
      globalLimit: Number(process.env.AI_RAG_GLOBAL_LIMIT) || 6,
      maxCosineDistance:
        Number(process.env.AI_RAG_MAX_COSINE_DISTANCE) || 0.72,
      backfillOnStartup:
        (process.env.AI_RAG_BACKFILL_ON_STARTUP ?? 'true') === 'true',
      backfillBatchSize: Number(process.env.AI_RAG_BACKFILL_BATCH_SIZE) || 5,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      apiKeys: process.env.OPENAI_API_KEYS,
      baseUrl: process.env.OPENAI_API_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 7000,
      totalTimeoutMs: Number(process.env.OPENAI_TOTAL_TIMEOUT_MS) || 12000,
      maxAttempts: Number(process.env.OPENAI_MAX_ATTEMPTS) || 10,
      keyCooldownMs: Number(process.env.OPENAI_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.OPENAI_INVALID_KEY_COOLDOWN_MS) || 600000,
    },
    openaiSecondary: {
      apiKey: process.env.OPENAI_SECONDARY_API_KEY,
      apiKeys: process.env.OPENAI_SECONDARY_API_KEYS,
      baseUrl:
        process.env.OPENAI_SECONDARY_API_BASE_URL ??
        'https://api.openai.com/v1',
      model: process.env.OPENAI_SECONDARY_MODEL ?? 'gpt-4o',
      timeoutMs: Number(process.env.OPENAI_SECONDARY_TIMEOUT_MS) || 7000,
      totalTimeoutMs:
        Number(process.env.OPENAI_SECONDARY_TOTAL_TIMEOUT_MS) || 12000,
      maxAttempts: Number(process.env.OPENAI_SECONDARY_MAX_ATTEMPTS) || 10,
      keyCooldownMs:
        Number(process.env.OPENAI_SECONDARY_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.OPENAI_SECONDARY_INVALID_KEY_COOLDOWN_MS) || 600000,
    },
    emailDraft: {
      apiKey: process.env.EMAIL_AI_API_KEY,
      apiKeys: process.env.EMAIL_AI_API_KEYS,
      baseUrl:
        process.env.EMAIL_AI_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      model: process.env.EMAIL_AI_MODEL ?? 'openai/gpt-oss-20b',
      timeoutMs: Number(process.env.EMAIL_AI_TIMEOUT_MS) || 10000,
      totalTimeoutMs: Number(process.env.EMAIL_AI_TOTAL_TIMEOUT_MS) || 22000,
      maxAttempts: Number(process.env.EMAIL_AI_MAX_ATTEMPTS) || 3,
      keyCooldownMs: Number(process.env.EMAIL_AI_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.EMAIL_AI_INVALID_KEY_COOLDOWN_MS) || 600000,
    },
    comparison: {
      apiKey: process.env.COMPARISON_AI_API_KEY,
      apiKeys: process.env.COMPARISON_AI_API_KEYS,
      baseUrl:
        process.env.COMPARISON_AI_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      model:
        process.env.COMPARISON_AI_MODEL ?? 'nvidia/nemotron-3-nano-30b-a3b',
      timeoutMs: Number(process.env.COMPARISON_AI_TIMEOUT_MS) || 6500,
      totalTimeoutMs:
        Number(process.env.COMPARISON_AI_TOTAL_TIMEOUT_MS) || 14000,
      maxAttempts: Number(process.env.COMPARISON_AI_MAX_ATTEMPTS) || 10,
      keyCooldownMs: Number(process.env.COMPARISON_AI_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.COMPARISON_AI_INVALID_KEY_COOLDOWN_MS) || 600000,
    },
    decisionComparison: {
      apiKey: process.env.DECISION_AI_API_KEY,
      apiKeys: process.env.DECISION_AI_API_KEYS,
      baseUrl:
        process.env.DECISION_AI_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      model:
        process.env.DECISION_AI_MODEL ?? 'mistralai/mistral-medium-3.5-128b',
      timeoutMs: Number(process.env.DECISION_AI_TIMEOUT_MS) || 8000,
      totalTimeoutMs: Number(process.env.DECISION_AI_TOTAL_TIMEOUT_MS) || 16000,
      maxAttempts: Number(process.env.DECISION_AI_MAX_ATTEMPTS) || 10,
      keyCooldownMs: Number(process.env.DECISION_AI_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.DECISION_AI_INVALID_KEY_COOLDOWN_MS) || 600000,
    },
    mistralAgent: {
      apiKey: process.env.MISTRAL_AGENT_API_KEY,
      apiKeys: process.env.MISTRAL_AGENT_API_KEYS,
      baseUrl:
        process.env.MISTRAL_AGENT_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      model: process.env.MISTRAL_AGENT_MODEL ?? 'mistralai/mistral-nemotron',
      timeoutMs: Number(process.env.MISTRAL_AGENT_TIMEOUT_MS) || 2500,
      totalTimeoutMs:
        Number(process.env.MISTRAL_AGENT_TOTAL_TIMEOUT_MS) || 10000,
      maxAttempts: Number(process.env.MISTRAL_AGENT_MAX_ATTEMPTS) || 10,
      keyCooldownMs: Number(process.env.MISTRAL_AGENT_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.MISTRAL_AGENT_INVALID_KEY_COOLDOWN_MS) || 600000,
      maxTokens: Number(process.env.MISTRAL_AGENT_MAX_TOKENS) || 2048,
      temperature: Number(process.env.MISTRAL_AGENT_TEMPERATURE) || 0.2,
    },
  },
  ml: {
    serviceUrl: process.env.ML_SERVICE_URL ?? 'http://localhost:8000',
    timeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 10000,
  },
});
