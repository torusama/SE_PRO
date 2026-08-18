import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

interface MissingEmbeddingRow {
  id: number;
  category: string;
  title: string;
  content: string;
  knowledgeType: string;
  memoryKey: string | null;
}

type EmbeddingInputType = 'query' | 'passage';

@Injectable()
export class KnowledgeEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeEmbeddingService.name);
  private readonly cooldownUntil = new Map<string, number>();
  private rotationCursor = 0;
  private schemaSupportCache: { value: boolean; expiresAt: number } | null =
    null;
  private backfillRunning = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.isConfigured() || !this.backfillOnStartup()) return;
    setTimeout(() => {
      void this.backfillStartupWindow().catch((error) => {
        this.logger.warn(
          `RAG startup backfill skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, 15_000);
  }

  isConfigured() {
    return (
      this.config.get<boolean>('ai.rag.enabled') !== false &&
      this.apiKeys().length > 0
    );
  }

  /**
   * RAG in this backend is intentionally pinned to a fixed vector dimension.
   * The migration switches the column to VECTOR(1024) for NVIDIA NIM models.
   * Checking the actual column type prevents a stale VECTOR(1536) schema from
   * causing a request-time error after upgrading from the previous build.
   */
  async supportsPgVector() {
    if (
      this.schemaSupportCache &&
      this.schemaSupportCache.expiresAt > Date.now()
    ) {
      return this.schemaSupportCache.value;
    }
    try {
      const row = await this.database.queryOne<{
        supported: boolean;
        columnType: string | null;
      }>(
        `SELECT
           (to_regtype('vector') IS NOT NULL AND a.attname IS NOT NULL) AS supported,
           CASE WHEN a.attname IS NULL THEN NULL
                ELSE format_type(a.atttypid, a.atttypmod)
           END AS "columnType"
         FROM (SELECT 1) seed
         LEFT JOIN pg_class c
           ON c.relname = 'ai_knowledge_entries'
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
         LEFT JOIN pg_attribute a
           ON a.attrelid = c.oid
          AND a.attname = 'embedding'
          AND a.attnum > 0
          AND NOT a.attisdropped`,
      );
      const expectedType = `vector(${this.embeddingDimension()})`;
      const value = Boolean(row?.supported) && row?.columnType === expectedType;
      if (row?.supported && !value) {
        this.logger.warn(
          `RAG vector column is ${row.columnType ?? 'unknown'}; expected ${expectedType}. Run database migrations before enabling semantic RAG.`,
        );
      }
      this.schemaSupportCache = {
        value,
        expiresAt: Date.now() + 60_000,
      };
      return value;
    } catch {
      this.schemaSupportCache = {
        value: false,
        expiresAt: Date.now() + 15_000,
      };
      return false;
    }
  }

  /**
   * Generate an embedding through the NVIDIA NIM /v1/embeddings endpoint.
   * The configured retrieval model uses query/passsage modes: query for the
   * live user question and passage for stored memory/knowledge. Keeping these
   * modes correct improves retrieval quality without changing validation.
   */
  async embed(
    text: string,
    inputType: EmbeddingInputType = 'query',
  ): Promise<number[]> {
    const input = text.trim().replace(/\s+/g, ' ').slice(0, 16_000);
    if (!input) throw new Error('Embedding input is empty');
    if (!this.isConfigured())
      throw new Error('Embedding provider is not configured');

    const keys = this.apiKeys();
    const maxAttempts = Math.min(
      keys.length,
      this.positiveConfig('ai.rag.maxAttempts', 2),
    );
    const timeoutMs = this.positiveConfig('ai.rag.timeoutMs', 1_000);
    const totalTimeoutMs = this.positiveConfig('ai.rag.totalTimeoutMs', 1_400);
    const deadline = Date.now() + totalTimeoutMs;
    const candidates = this.selectHealthyKeys(keys).slice(0, maxAttempts);
    if (!candidates.length)
      throw new Error('All embedding API keys are cooling down');

    let lastError: unknown;
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const apiKey = candidates[attempt];
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(250, Math.min(timeoutMs, remaining)),
      );
      try {
        const response = await fetch(`${this.baseUrl()}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.embeddingModel(),
            input: [input],
            input_type: inputType,
            encoding_format: 'float',
            truncate: 'END',
            dimensions: this.embeddingDimension(),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = (await response.text().catch(() => '')).slice(0, 300);
          const error = new Error(
            `Embedding HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
          );
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }
        const payload = (await response.json()) as EmbeddingResponse;
        const vector = payload.data?.[0]?.embedding;
        if (!Array.isArray(vector) || !vector.length) {
          throw new Error('Embedding API returned an invalid vector');
        }
        const expectedDimension = this.embeddingDimension();
        if (vector.length !== expectedDimension) {
          throw new Error(
            `Embedding dimension ${vector.length} does not match configured ${expectedDimension}`,
          );
        }
        this.cooldownUntil.delete(apiKey);
        return vector;
      } catch (error) {
        lastError = error;
        if (this.isTransient(error)) this.cooldown(apiKey, error);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Embedding API unavailable');
  }

  async embedKnowledgeEntry(entryId: number) {
    if (!this.isConfigured() || !(await this.supportsPgVector())) return false;
    const row = await this.database.queryOne<MissingEmbeddingRow>(
      `SELECT knowledge_entry_id AS id,
              category, title, content,
              knowledge_type AS "knowledgeType",
              memory_key AS "memoryKey"
       FROM ai_knowledge_entries
       WHERE knowledge_entry_id = $1
         AND is_active = TRUE
         AND validation_status = 'active'`,
      [entryId],
    );
    if (!row?.content?.trim()) return false;
    const vector = await this.embed(this.knowledgePassage(row), 'passage');
    await this.database.query(
      `UPDATE ai_knowledge_entries
       SET embedding = $1::vector,
           embedding_model = $2,
           embedded_at = NOW()
       WHERE knowledge_entry_id = $3
         AND is_active = TRUE
         AND validation_status = 'active'`,
      [this.vectorLiteral(vector), this.embeddingModel(), entryId],
    );
    return true;
  }

  async backfillMissingActiveEntries(maxRows?: number) {
    if (this.backfillRunning || !this.isConfigured()) return 0;
    if (!(await this.supportsPgVector())) {
      this.logger.warn(
        'Semantic RAG is unavailable because PostgreSQL has no compatible pgvector column; structured SQL knowledge fallback remains active.',
      );
      return 0;
    }
    this.backfillRunning = true;
    let completed = 0;
    try {
      const configuredBatchSize = Math.min(
        this.positiveConfig('ai.rag.backfillBatchSize', 5),
        10,
      );
      const limit = Math.max(
        1,
        Math.min(maxRows ?? configuredBatchSize, configuredBatchSize),
      );
      const model = this.embeddingModel();
      const rows = await this.database.query<MissingEmbeddingRow>(
        `SELECT knowledge_entry_id AS id,
                category, title, content,
                knowledge_type AS "knowledgeType",
                memory_key AS "memoryKey"
         FROM ai_knowledge_entries
         WHERE is_active = TRUE
           AND validation_status = 'active'
           AND (embedding IS NULL OR embedding_model IS DISTINCT FROM $1)
         ORDER BY updated_at DESC, knowledge_entry_id DESC
         LIMIT $2`,
        [model, limit],
      );
      for (const row of rows) {
        try {
          const vector = await this.embed(this.knowledgePassage(row), 'passage');
          await this.database.query(
            `UPDATE ai_knowledge_entries
             SET embedding = $1::vector,
                 embedding_model = $2,
                 embedded_at = NOW()
             WHERE knowledge_entry_id = $3
               AND is_active = TRUE
               AND validation_status = 'active'`,
            [this.vectorLiteral(vector), model, row.id],
          );
          completed += 1;
        } catch (error) {
          this.logger.warn(
            `Could not embed knowledge entry ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (completed > 0) {
        this.logger.log(
          `RAG backfilled ${completed} active knowledge entries with ${model}`,
        );
      }
      return completed;
    } finally {
      this.backfillRunning = false;
    }
  }

  private knowledgePassage(row: MissingEmbeddingRow) {
    return [
      `[${row.knowledgeType || 'knowledge'}]`,
      row.memoryKey ? `Memory key: ${row.memoryKey}` : '',
      row.category ? `Category: ${row.category}` : '',
      row.title ? `Title: ${row.title}` : '',
      `Content: ${row.content}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  vectorLiteral(vector: number[]) {
    return `[${vector.join(',')}]`;
  }

  userRetrievalLimit() {
    return this.positiveConfig('ai.rag.userLimit', 8);
  }

  globalRetrievalLimit() {
    return this.positiveConfig('ai.rag.globalLimit', 6);
  }

  embeddingModel() {
    return (
      this.config.get<string>('ai.rag.model') ??
      'nvidia/llama-nemotron-embed-1b-v2'
    );
  }

  embeddingDimension() {
    return this.positiveConfig('ai.rag.dimension', 1024);
  }

  private baseUrl() {
    return (
      this.config.get<string>('ai.rag.baseUrl') ??
      'https://integrate.api.nvidia.com/v1'
    ).replace(/\/+$/, '');
  }

  private backfillOnStartup() {
    return this.config.get<boolean>('ai.rag.backfillOnStartup') !== false;
  }

  private async backfillStartupWindow() {
    const maxEntries = Math.min(
      this.positiveConfig('ai.rag.backfillMaxEntries', 25),
      100,
    );
    let total = 0;
    while (total < maxEntries) {
      const completed = await this.backfillMissingActiveEntries(
        maxEntries - total,
      );
      total += completed;
      // Zero means either the queue is drained or the remaining row(s) failed.
      // Stop instead of hammering the embedding provider during startup.
      if (completed === 0) break;
    }
    if (total > 0) {
      this.logger.log(`RAG startup window embedded ${total} knowledge entries.`);
    }
    return total;
  }

  private apiKeys() {
    const explicit = [
      ...new Set([
        ...this.parseKeyList(this.config.get<string>('ai.rag.apiKey')),
        ...this.parseKeyList(
          this.config.get<string | string[]>('ai.rag.apiKeys'),
        ),
      ]),
    ];
    return explicit;
  }

  private parseKeyList(value?: string | string[]) {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value !== 'string' || !value.trim()) return [];
    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // Also accept comma/semicolon/newline separated keys and simple wrappers.
    }
    const unwrapped = trimmed
      .replace(/^\s*[[{]\s*/, '')
      .replace(/\s*[\]}]\s*$/, '');
    return unwrapped
      .split(/[\s,;]+/)
      .map((item) => item.replace(/^['"]|['"]$/g, '').trim())
      .filter(Boolean);
  }

  private selectHealthyKeys(keys: string[]) {
    const now = Date.now();
    const start = this.rotationCursor % keys.length;
    this.rotationCursor = (this.rotationCursor + 1) % keys.length;
    return keys
      .map((_, offset) => keys[(start + offset) % keys.length])
      .filter((key) => (this.cooldownUntil.get(key) ?? 0) <= now);
  }

  private cooldown(apiKey: string, error: unknown) {
    const status = (error as { status?: number } | null)?.status;
    const duration =
      status === 401 || status === 403
        ? this.positiveConfig('ai.rag.invalidKeyCooldownMs', 600_000)
        : status === 429
          ? this.positiveConfig('ai.rag.keyCooldownMs', 60_000)
          : this.positiveConfig('ai.router.transientKeyCooldownMs', 800);
    this.cooldownUntil.set(apiKey, Date.now() + duration);
  }

  private isTransient(error: unknown) {
    const status = (error as { status?: number } | null)?.status;
    if (typeof status === 'number') {
      return (
        status === 401 ||
        status === 403 ||
        status === 408 ||
        status === 429 ||
        status >= 500
      );
    }
    const message =
      error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return /abort|timeout|network|fetch|socket|connection|econn/i.test(message);
  }

  private positiveConfig(key: string, fallback: number) {
    const value = Number(this.config.get<number | string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
