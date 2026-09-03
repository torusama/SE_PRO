import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaChatResponse, NvidiaMessage } from './types/nvidia.types';

class NvidiaHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`NVIDIA HTTP ${status}`);
  }
}

class EmptyNvidiaResponseError extends Error {
  constructor() {
    super('NVIDIA API returned an empty assistant response');
  }
}

type LlmCallOptions = {
  temperature?: number;
  maxTokens?: number;
  routingKey?: string;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  /** Cancels a losing hedged request without cooling down its healthy key. */
  signal?: AbortSignal;
};

interface KeyCandidate {
  apiKey: string;
  slot: number;
  cooldownUntil: number;
}

@Injectable()
export class NvidiaNemotronService {
  private readonly logger = new Logger(NvidiaNemotronService.name);
  private readonly cooldownUntil = new Map<string, number>();
  private readonly affinity = new Map<
    string,
    { apiKey: string; expiresAt: number }
  >();
  private rotationCursor = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return (
      this.config.get<boolean>('ai.enableLlm') !== false &&
      this.getConfiguredApiKeys().length > 0
    );
  }

  get model() {
    return (
      this.config.get<string>('ai.mistralAgent.model') ??
      'mistralai/mistral-nemotron'
    );
  }

  async chat(
    messages: NvidiaMessage[],
    tools: readonly unknown[] = [],
    toolChoice: unknown = 'auto',
    options: LlmCallOptions = {},
  ): Promise<NvidiaChatResponse> {
    const apiKeys = this.getConfiguredApiKeys();
    if (
      this.config.get<boolean>('ai.enableLlm') === false ||
      apiKeys.length === 0
    ) {
      throw new ServiceUnavailableException('NVIDIA agent is not configured');
    }

    const baseUrl = (
      this.config.get<string>('ai.mistralAgent.baseUrl') ??
      'https://integrate.api.nvidia.com/v1'
    ).replace(/\/+$/, '');
    const configuredTimeoutMs = this.positiveConfig(
      'ai.mistralAgent.timeoutMs',
      2_500,
    );
    const timeoutMs = this.clampTimeout(options.timeoutMs, configuredTimeoutMs);
    const totalTimeoutMs = this.clampTimeout(
      options.totalTimeoutMs,
      this.positiveConfig('ai.mistralAgent.totalTimeoutMs', 10_000),
    );
    const maxAttempts = Math.min(
      apiKeys.length,
      this.positiveConfig('ai.mistralAgent.maxAttempts', 10),
    );
    const body = {
      model: this.model,
      messages,
      ...(tools.length
        ? {
            tools,
            tool_choice: toolChoice,
          }
        : {}),
      temperature:
        options.temperature ??
        this.config.get<number>('ai.mistralAgent.temperature') ??
        0.2,
      max_tokens:
        options.maxTokens ??
        this.config.get<number>('ai.mistralAgent.maxTokens') ??
        2048,
      stream: false,
    };

    const candidates = this.selectCandidates(
      apiKeys,
      maxAttempts,
      options.routingKey,
    );
    if (!candidates.length) {
      throw new ServiceUnavailableException(
        'All NVIDIA API keys are temporarily cooling down',
      );
    }

    const deadline = Date.now() + totalTimeoutMs;
    let lastError: unknown;

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const candidate = candidates[attempt];
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) break;
      // Fast credential failures can rotate immediately. A slow request gets
      // the configured timeout and then yields to the next provider route.
      const attemptTimeoutMs = Math.min(timeoutMs, remainingBudgetMs);
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) abortFromCaller();
      else
        options.signal?.addEventListener('abort', abortFromCaller, {
          once: true,
        });
      const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
      try {
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
          throw new NvidiaHttpError(
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
          throw new EmptyNvidiaResponseError();
        }
        this.rememberAffinity(options.routingKey, candidate.apiKey);
        return payload;
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted) throw error;
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
          error instanceof NvidiaHttpError &&
          this.isRetryableStatus(error.status);
        const retryable =
          isTimeout ||
          isNetworkFailure ||
          retryableHttp ||
          error instanceof EmptyNvidiaResponseError;

        if (retryable) {
          this.cooldownKey(
            candidate.apiKey,
            error instanceof NvidiaHttpError ? error : undefined,
          );
          this.forgetAffinityIfMatches(options.routingKey, candidate.apiKey);
          this.logger.warn(
            `NVIDIA attempt ${attempt + 1}/${candidates.length} failed on key slot ${candidate.slot + 1}; ${this.safeFailureReason(error, isTimeout)}`,
          );
          if (attempt + 1 < candidates.length && Date.now() < deadline) {
            continue;
          }
        }

        if (error instanceof ServiceUnavailableException) throw error;
        if (error instanceof NvidiaHttpError) {
          throw new ServiceUnavailableException(
            `NVIDIA API unavailable (HTTP ${error.status})`,
          );
        }
        throw new ServiceUnavailableException('NVIDIA API unavailable');
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortFromCaller);
      }
    }
    throw new ServiceUnavailableException(
      lastError instanceof NvidiaHttpError
        ? `NVIDIA API unavailable (HTTP ${lastError.status})`
        : 'NVIDIA API unavailable',
    );
  }

  private getConfiguredApiKeys() {
    const multiple = this.config.get<string | string[]>(
      'ai.mistralAgent.apiKeys',
    );
    const legacy = this.config.get<string>('ai.mistralAgent.apiKey');
    const values = [
      ...this.parseApiKeyList(multiple),
      ...this.parseApiKeyList(legacy),
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
      // Also accept a simple multiline block wrapped in {} or [].
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

  private cooldownKey(apiKey: string, error?: NvidiaHttpError) {
    const normalCooldownMs = this.positiveConfig(
      'ai.mistralAgent.keyCooldownMs',
      60_000,
    );
    const invalidKeyCooldownMs = this.positiveConfig(
      'ai.mistralAgent.invalidKeyCooldownMs',
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

  private retryAfterMs(value: string | null) {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
  }

  private safeFailureReason(error: unknown, isTimeout: boolean) {
    if (isTimeout) return 'timeout';
    if (error instanceof NvidiaHttpError) return `HTTP ${error.status}`;
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
