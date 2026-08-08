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
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      apiKeys: process.env.OPENAI_API_KEYS,
      baseUrl: process.env.OPENAI_API_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 15000,
    },
    openaiSecondary: {
      apiKey: process.env.OPENAI_SECONDARY_API_KEY,
      apiKeys: process.env.OPENAI_SECONDARY_API_KEYS,
      baseUrl:
        process.env.OPENAI_SECONDARY_API_BASE_URL ??
        'https://api.openai.com/v1',
      model: process.env.OPENAI_SECONDARY_MODEL ?? 'gpt-4o',
      timeoutMs: Number(process.env.OPENAI_SECONDARY_TIMEOUT_MS) || 15000,
    },
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      apiKeys: process.env.NVIDIA_API_KEYS,
      baseUrl:
        process.env.NVIDIA_API_BASE_URL ??
        'https://integrate.api.nvidia.com/v1',
      model: process.env.NVIDIA_MODEL ?? 'meta/llama-3.1-70b-instruct',
      timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS) || 15000,
      totalTimeoutMs: Number(process.env.NVIDIA_TOTAL_TIMEOUT_MS) || 30000,
      maxAttempts: Number(process.env.NVIDIA_MAX_ATTEMPTS) || 3,
      keyCooldownMs: Number(process.env.NVIDIA_KEY_COOLDOWN_MS) || 60000,
      invalidKeyCooldownMs:
        Number(process.env.NVIDIA_INVALID_KEY_COOLDOWN_MS) || 600000,
      maxTokens: Number(process.env.NVIDIA_MAX_TOKENS) || 2048,
      temperature: Number(process.env.NVIDIA_TEMPERATURE) || 0.2,
    },
  },
  ml: {
    serviceUrl: process.env.ML_SERVICE_URL ?? 'http://localhost:8000',
    timeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 10000,
  },
});
