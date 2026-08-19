import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { NvidiaChatResponse, NvidiaMessage } from './types/nvidia.types';

class OpenAiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`OpenAI HTTP ${status}`);
  }
}

class EmptyOpenAiResponseError extends Error {
  constructor() {
    super('OpenAI API returned an empty assistant response');
  }
}

type LlmCallOptions = {
  temperature?: number;
  maxTokens?: number;
  routingKey?: string;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  enableThinking?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  // Consumed by MultiProviderLlmService when this provider participates in a
  // shared route. Dedicated calls safely ignore these routing-only options.
  validateResponse?: (response: NvidiaChatResponse) => boolean;
  preferredProviderId?: string;
  strictPreferredProvider?: boolean;
  /** Internal: MultiProviderLlmService records the provider attempt itself. */
  skipRuntimeTelemetry?: boolean;
};

interface KeyCandidate {
  apiKey: string;
  slot: number;
  cooldownUntil: number;
}

@Injectable()
export class OpenAiService {
  protected readonly logger: Logger;
  private readonly cooldownUntil = new Map<string, number>();
  private readonly affinity = new Map<
    string,
    { apiKey: string; expiresAt: number }
  >();
  private rotationCursor = 0;

  constructor(
    protected readonly config: ConfigService,
    @Optional() private readonly database?: DatabaseService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  protected get configPrefix(): string {
    return 'ai.openai';
  }

  isConfigured(): boolean {
    return (
      this.config.get<boolean>('ai.enableLlm') !== false &&
      this.getConfiguredApiKeys().length > 0
    );
  }

  get model(): string {
    return (
      this.config.get<string>(`${this.configPrefix}.model`) ?? 'gpt-4o-mini'
    );
  }

  async chat(
    messages: NvidiaMessage[],
    tools: readonly unknown[] = [],
    toolChoice: unknown = 'auto',
    options: LlmCallOptions = {},
  ): Promise<NvidiaChatResponse> {
    const runtimeStartedAt = Date.now();
    const apiKeys = this.getConfiguredApiKeys();
    if (
      this.config.get<boolean>('ai.enableLlm') === false ||
      apiKeys.length === 0
    ) {
      throw new ServiceUnavailableException(
        `OpenAI provider (${this.configPrefix}) is not configured`,
      );
    }

    const baseUrl = (
      this.config.get<string>(`${this.configPrefix}.baseUrl`) ??
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const configuredTimeoutMs = this.positiveConfig(
      `${this.configPrefix}.timeoutMs`,
      7_000,
    );
    const timeoutMs = this.clampTimeout(options.timeoutMs, configuredTimeoutMs);
    const totalTimeoutMs = this.clampTimeout(
      options.totalTimeoutMs,
      this.positiveConfig(`${this.configPrefix}.totalTimeoutMs`, 12_000),
    );
    const maxAttempts = Math.min(
      apiKeys.length,
      this.positiveConfig(`${this.configPrefix}.maxAttempts`, 10),
    );

    const body = {
      model: this.model,
      messages,
      temperature:
        options.temperature ??
        this.config.get<number>(`${this.configPrefix}.temperature`) ??
        0.2,
      max_tokens:
        options.maxTokens ??
        this.config.get<number>(`${this.configPrefix}.maxTokens`) ??
        2048,
      chat_template_kwargs:
        options.enableThinking === undefined
          ? undefined
          : { enable_thinking: options.enableThinking },
      reasoning_effort: options.reasoningEffort,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
    };

    const candidates = this.selectCandidates(
      apiKeys,
      maxAttempts,
      options.routingKey,
    );
    if (!candidates.length) {
      const error = new ServiceUnavailableException(
        `All OpenAI API keys are temporarily cooling down for provider (${this.configPrefix})`,
      );
      this.recordRuntimeMetric({
        routingKey: options.routingKey,
        latencyMs: Date.now() - runtimeStartedAt,
        status: 'failed',
        error,
        skip: options.skipRuntimeTelemetry,
      });
      throw error;
    }

    const deadline = Date.now() + totalTimeoutMs;
    let lastError: unknown;

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const candidate = candidates[attempt];
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) break;
      // Give the active key its real per-request timeout. Fast failures such as
      // 401/429 still leave budget for rotation; a genuine timeout should move
      // to the next provider instead of starving every key to one second.
      const attemptTimeoutMs = Math.min(timeoutMs, remainingBudgetMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);

      try {
        this.logger.log(
          `Sending OpenAI request to model "${this.model}" (key slot ${candidate.slot + 1}/${apiKeys.length})`,
        );

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${candidate.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          await response.text().catch(() => '');
          throw new OpenAiHttpError(
            response.status,
            this.retryAfterMs(response.headers.get('retry-after')),
          );
        }

        const payload = (await response.json()) as NvidiaChatResponse;
        const assistant = payload.choices?.[0]?.message;
        if (
          !assistant ||
          (!assistant.content?.trim() && !assistant.tool_calls?.length)
        ) {
          throw new EmptyOpenAiResponseError();
        }
        this.rememberAffinity(options.routingKey, candidate.apiKey);
        this.recordRuntimeMetric({
          result: payload,
          routingKey: options.routingKey,
          latencyMs: Date.now() - runtimeStartedAt,
          status: 'success',
          skip: options.skipRuntimeTelemetry,
        });
        return payload;
      } catch (error) {
        lastError = error;
        const isTimeout =
          error instanceof Error &&
          (error.name === 'AbortError' || /timeout/i.test(error.message));
        const isNetworkFailure =
          error instanceof TypeError ||
          (error instanceof Error &&
            /fetch failed|network|socket|connection|econn/i.test(
              error.message,
            ));
        const retryableHttp =
          error instanceof OpenAiHttpError &&
          this.isRetryableStatus(error.status);
        const retryable =
          isTimeout ||
          isNetworkFailure ||
          retryableHttp ||
          error instanceof EmptyOpenAiResponseError;

        if (retryable) {
          this.cooldownKey(
            candidate.apiKey,
            error instanceof OpenAiHttpError ? error : undefined,
          );
          this.forgetAffinityIfMatches(options.routingKey, candidate.apiKey);
          this.logger.warn(
            `OpenAI attempt ${attempt + 1}/${candidates.length} failed on key slot ${candidate.slot + 1}; ${this.safeFailureReason(error, isTimeout)}`,
          );
          if (attempt + 1 < candidates.length && Date.now() < deadline) {
            continue;
          }
        }

        if (error instanceof ServiceUnavailableException) {
          this.recordRuntimeMetric({
            routingKey: options.routingKey,
            latencyMs: Date.now() - runtimeStartedAt,
            status: 'failed',
            error,
            skip: options.skipRuntimeTelemetry,
          });
          throw error;
        }
        if (error instanceof OpenAiHttpError) {
          const terminalError = new ServiceUnavailableException(
            `OpenAI API unavailable (HTTP ${error.status})`,
          );
          this.recordRuntimeMetric({
            routingKey: options.routingKey,
            latencyMs: Date.now() - runtimeStartedAt,
            status: 'failed',
            error: terminalError,
            skip: options.skipRuntimeTelemetry,
          });
          throw terminalError;
        }
        const terminalError = new ServiceUnavailableException(
          'OpenAI API unavailable',
        );
        this.recordRuntimeMetric({
          routingKey: options.routingKey,
          latencyMs: Date.now() - runtimeStartedAt,
          status: 'failed',
          error: terminalError,
          skip: options.skipRuntimeTelemetry,
        });
        throw terminalError;
      } finally {
        clearTimeout(timer);
      }
    }

    const terminalError = new ServiceUnavailableException(
      lastError instanceof OpenAiHttpError
        ? `OpenAI API unavailable (HTTP ${lastError.status})`
        : 'OpenAI API unavailable',
    );
    this.recordRuntimeMetric({
      routingKey: options.routingKey,
      latencyMs: Date.now() - runtimeStartedAt,
      status: 'failed',
      error: terminalError,
      skip: options.skipRuntimeTelemetry,
    });
    throw terminalError;
  }

  private recordRuntimeMetric(input: {
    result?: NvidiaChatResponse;
    routingKey?: string;
    latencyMs: number;
    status: 'success' | 'failed';
    error?: unknown;
    skip?: boolean;
  }) {
    if (input.skip || !this.database) return;
    const usage = input.result?.usage;
    const promptTokens = this.nonNegativeInteger(
      usage?.prompt_tokens ?? usage?.promptTokens,
    );
    const completionTokens = this.nonNegativeInteger(
      usage?.completion_tokens ?? usage?.completionTokens,
    );
    const totalTokens =
      this.nonNegativeInteger(usage?.total_tokens ?? usage?.totalTokens) ??
      (promptTokens !== undefined && completionTokens !== undefined
        ? promptTokens + completionTokens
        : undefined);
    const errorMessage =
      input.error instanceof Error
        ? input.error.message.slice(0, 1200)
        : input.error
          ? String(input.error).slice(0, 1200)
          : null;
    const errorType =
      input.error instanceof Error ? input.error.name.slice(0, 100) : null;

    void this.database
      .query(
        `INSERT INTO ai_llm_calls
           (routing_key, provider_id, provider_name, model, status,
            prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd,
            latency_ms, error_type, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          input.routingKey?.slice(0, 180) ?? null,
          this.telemetryProviderId(),
          this.constructor.name,
          input.result?.model ?? this.model,
          input.status,
          promptTokens ?? null,
          completionTokens ?? null,
          totalTokens ?? null,
          this.estimateRuntimeCostUsd(promptTokens, completionTokens),
          Math.max(0, Math.round(input.latencyMs)),
          errorType,
          errorMessage,
        ],
      )
      .catch((error) =>
        this.logger.warn(
          `[AI telemetry] Direct runtime metric could not be persisted: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
  }

  private telemetryProviderId(): string {
    switch (this.configPrefix) {
      case 'ai.openai':
        return 'openai-primary';
      case 'ai.openaiSecondary':
        return 'openai-secondary';
      case 'ai.emailDraft':
        return 'email-draft';
      case 'ai.comparison':
        return 'comparison';
      case 'ai.decisionComparison':
        return 'decision-comparison';
      default:
        return this.configPrefix.replace(/^ai\./, '');
    }
  }

  private estimateRuntimeCostUsd(
    promptTokens?: number,
    completionTokens?: number,
  ): number | null {
    if (promptTokens === undefined && completionTokens === undefined) return null;
    const telemetryKey =
      this.configPrefix === 'ai.openai'
        ? 'openaiPrimary'
        : this.configPrefix === 'ai.openaiSecondary'
          ? 'openaiSecondary'
          : this.configPrefix === 'ai.emailDraft'
            ? 'emailDraft'
            : this.configPrefix === 'ai.comparison'
              ? 'comparison'
              : this.configPrefix === 'ai.decisionComparison'
                ? 'decisionComparison'
                : null;
    if (!telemetryKey) return null;
    const inputRate = Number(
      this.config.get<number | string>(
        `ai.telemetry.${telemetryKey}.inputUsdPerMillion`,
      ),
    );
    const outputRate = Number(
      this.config.get<number | string>(
        `ai.telemetry.${telemetryKey}.outputUsdPerMillion`,
      ),
    );
    if (
      (!Number.isFinite(inputRate) || inputRate <= 0) &&
      (!Number.isFinite(outputRate) || outputRate <= 0)
    ) {
      return null;
    }
    return (
      ((promptTokens ?? 0) * Math.max(0, inputRate || 0) +
        (completionTokens ?? 0) * Math.max(0, outputRate || 0)) /
      1_000_000
    );
  }

  private nonNegativeInteger(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.floor(parsed)
      : undefined;
  }

  getConfiguredApiKeys(): string[] {
    const rawSingle = this.config.get<string>(`${this.configPrefix}.apiKey`);
    const rawMultiple = this.config.get<string | string[]>(
      `${this.configPrefix}.apiKeys`,
    );
    const values = [
      ...this.parseApiKeyList(rawSingle),
      ...this.parseApiKeyList(rawMultiple),
    ];
    return [
      ...new Set(
        values
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ];
  }

  private parseApiKeyList(value?: string | string[]) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];

    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string',
        );
      }
    } catch {
      // Accept simple multiline blocks wrapped in {} or [].
    }

    const withoutOpeningWrapper =
      trimmed.startsWith('{') || trimmed.startsWith('[')
        ? trimmed.slice(1)
        : trimmed;
    const withoutWrappers =
      withoutOpeningWrapper.endsWith('}') || withoutOpeningWrapper.endsWith(']')
        ? withoutOpeningWrapper.slice(0, -1)
        : withoutOpeningWrapper;

    return withoutWrappers
      .split(/[\s,;]+/)
      .map((item) => item.replace(/^['"]|['"]$/g, '').trim())
      .filter(Boolean);
  }

  private selectCandidates(
    apiKeys: string[],
    maxAttempts: number,
    routingKey?: string,
  ): KeyCandidate[] {
    this.pruneAffinity();
    const affinityKey = routingKey
      ? this.affinity.get(routingKey)?.apiKey
      : undefined;
    const affinityIndex = affinityKey ? apiKeys.indexOf(affinityKey) : -1;
    const startIndex =
      affinityIndex >= 0 ? affinityIndex : this.rotationCursor % apiKeys.length;
    if (affinityIndex < 0) {
      this.rotationCursor = (this.rotationCursor + 1) % apiKeys.length;
    }

    const ordered = apiKeys.map((_, offset) => {
      const slot = (startIndex + offset) % apiKeys.length;
      return {
        apiKey: apiKeys[slot],
        slot,
        cooldownUntil: this.cooldownUntil.get(apiKeys[slot]) ?? 0,
      };
    });
    const now = Date.now();
    return ordered
      .filter((candidate) => candidate.cooldownUntil <= now)
      .slice(0, maxAttempts);
  }

  private rememberAffinity(routingKey: string | undefined, apiKey: string) {
    if (!routingKey) return;
    this.affinity.set(routingKey, {
      apiKey,
      expiresAt: Date.now() + 120_000,
    });
  }

  private forgetAffinityIfMatches(
    routingKey: string | undefined,
    apiKey: string,
  ) {
    if (!routingKey) return;
    if (this.affinity.get(routingKey)?.apiKey === apiKey) {
      this.affinity.delete(routingKey);
    }
  }

  private pruneAffinity() {
    const now = Date.now();
    for (const [key, value] of this.affinity) {
      if (value.expiresAt <= now) this.affinity.delete(key);
    }
  }

  private cooldownKey(apiKey: string, error?: OpenAiHttpError) {
    const normalCooldownMs = this.positiveConfig(
      `${this.configPrefix}.keyCooldownMs`,
      60_000,
    );
    const invalidKeyCooldownMs = this.positiveConfig(
      `${this.configPrefix}.invalidKeyCooldownMs`,
      600_000,
    );
    const transientCooldownMs = this.positiveConfig(
      'ai.router.transientKeyCooldownMs',
      800,
    );
    const status = error?.status;
    const cooldownMs =
      status === 401 || status === 403
        ? invalidKeyCooldownMs
        : status === 429
          ? Math.max(normalCooldownMs, error?.retryAfterMs ?? 0)
          : transientCooldownMs;
    this.cooldownUntil.set(apiKey, Date.now() + cooldownMs);
  }

  private isRetryableStatus(status: number) {
    return (
      status === 401 ||
      status === 403 ||
      status === 408 ||
      status === 429 ||
      status >= 500
    );
  }

  private retryAfterMs(headerValue?: string | null) {
    if (!headerValue) return undefined;
    const seconds = Number(headerValue);
    if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
    const absoluteTime = Date.parse(headerValue);
    if (!Number.isNaN(absoluteTime)) {
      return Math.max(0, absoluteTime - Date.now());
    }
    return undefined;
  }

  private safeFailureReason(error: unknown, isTimeout: boolean) {
    if (isTimeout) return 'timeout';
    if (error instanceof OpenAiHttpError) return `HTTP ${error.status}`;
    return 'network error';
  }

  private positiveConfig(key: string, fallback: number) {
    const value = Number(this.config.get<number | string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private clampTimeout(value: number | undefined, fallback: number) {
    if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
    return Math.max(250, Math.floor(Number(value)));
  }
}

@Injectable()
export class OpenAiSecondaryService extends OpenAiService {
  protected override get configPrefix(): string {
    return 'ai.openaiSecondary';
  }
}

/**
 * Dedicated content-generation pool for memorial reminder emails and plot
 * introductions. Keeping one provider instance lets both low-volume tasks
 * share key rotation, affinity and cooldown state while remaining isolated
 * from customer chat and suggested follow-ups.
 */
@Injectable()
export class EmailDraftAiService extends OpenAiService {
  protected override get configPrefix(): string {
    return 'ai.emailDraft';
  }
}

/**
 * Dedicated, OpenAI-compatible NVIDIA NIM route for comparison insights.
 * Its key rotation and cooldown state are deliberately isolated from chat.
 */
@Injectable()
export class ComparisonAiService extends OpenAiService {
  protected override get configPrefix(): string {
    return 'ai.comparison';
  }
}

/**
 * The deeper decision model has its own keys and rotation state. It is
 * preferred for comparison analysis, while ComparisonAiService remains the
 * independent fast fallback pool.
 */
@Injectable()
export class DecisionComparisonAiService extends OpenAiService {
  protected override get configPrefix(): string {
    return 'ai.decisionComparison';
  }
}
