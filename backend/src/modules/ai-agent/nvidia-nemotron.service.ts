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

@Injectable()
export class NvidiaNemotronService {
  private readonly logger = new Logger(NvidiaNemotronService.name);
  private readonly cooldownUntil = new Map<string, number>();
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
      this.config.get<string>('ai.nvidia.model') ?? 'mistralai/mistral-nemotron'
    );
  }

  async chat(
    messages: NvidiaMessage[],
    tools: readonly unknown[] = [],
    toolChoice: unknown = 'auto',
    options: { temperature?: number } = {},
  ) {
    const apiKeys = this.getConfiguredApiKeys();
    if (
      this.config.get<boolean>('ai.enableLlm') === false ||
      apiKeys.length === 0
    ) {
      throw new ServiceUnavailableException('NVIDIA agent is not configured');
    }

    const baseUrl = (
      this.config.get<string>('ai.nvidia.baseUrl') ??
      'https://integrate.api.nvidia.com/v1'
    ).replace(/\/+$/, '');
    const timeoutMs = this.positiveConfig('ai.nvidia.timeoutMs', 30_000);
    const totalTimeoutMs = this.positiveConfig(
      'ai.nvidia.totalTimeoutMs',
      55_000,
    );
    const maxAttempts = Math.min(
      apiKeys.length,
      this.positiveConfig('ai.nvidia.maxAttempts', 3),
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
        this.config.get<number>('ai.nvidia.temperature') ??
        0.2,
      max_tokens: this.config.get<number>('ai.nvidia.maxTokens') ?? 2048,
      stream: false,
    };

    const candidates = this.selectCandidates(apiKeys, maxAttempts);
    const deadline = Date.now() + totalTimeoutMs;
    let lastError: unknown;

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const candidate = candidates[attempt];
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) break;
      const remainingAttempts = candidates.length - attempt;
      const attemptTimeoutMs = Math.max(
        1,
        Math.min(timeoutMs, Math.floor(remainingBudgetMs / remainingAttempts)),
      );
      const controller = new AbortController();
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
        if (!payload.choices?.[0]?.message) {
          throw new ServiceUnavailableException(
            'NVIDIA API returned an invalid response',
          );
        }
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
          error instanceof NvidiaHttpError &&
          this.isRetryableStatus(error.status);
        const retryable = isTimeout || isNetworkFailure || retryableHttp;

        if (retryable) {
          this.cooldownKey(
            candidate.apiKey,
            error instanceof NvidiaHttpError ? error : undefined,
          );
          this.logger.warn(
            `NVIDIA attempt ${attempt + 1}/${candidates.length} failed on key slot ${candidate.slot + 1}; ${this.safeFailureReason(error, isTimeout)}`,
          );
          if (attempt + 1 < candidates.length && Date.now() < deadline) {
            continue;
          }
        }

        if (
          error instanceof ServiceUnavailableException ||
          error instanceof NvidiaHttpError
        ) {
          throw new ServiceUnavailableException(
            error instanceof NvidiaHttpError
              ? `NVIDIA API unavailable (HTTP ${error.status})`
              : error.message,
          );
        }
        throw new ServiceUnavailableException('NVIDIA API unavailable');
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ServiceUnavailableException(
      lastError instanceof NvidiaHttpError
        ? `NVIDIA API unavailable (HTTP ${lastError.status})`
        : 'NVIDIA API unavailable',
    );
  }

  private getConfiguredApiKeys() {
    const multiple = this.config.get<string | string[]>('ai.nvidia.apiKeys');
    const legacy = this.config.get<string>('ai.nvidia.apiKey');
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

  private selectCandidates(apiKeys: string[], maxAttempts: number) {
    const startIndex = this.rotationCursor % apiKeys.length;
    this.rotationCursor = (this.rotationCursor + 1) % apiKeys.length;
    const ordered = apiKeys.map((_, offset) => {
      const slot = (startIndex + offset) % apiKeys.length;
      return {
        apiKey: apiKeys[slot],
        slot,
        cooldownUntil: this.cooldownUntil.get(apiKeys[slot]) ?? 0,
      };
    });
    const now = Date.now();
    const available = ordered.filter(
      (candidate) => candidate.cooldownUntil <= now,
    );
    const selected =
      available.length > 0
        ? available
        : [
            [...ordered].sort(
              (left, right) => left.cooldownUntil - right.cooldownUntil,
            )[0],
          ];
    return selected.slice(0, maxAttempts);
  }

  private cooldownKey(apiKey: string, error?: NvidiaHttpError) {
    const normalCooldownMs = this.positiveConfig(
      'ai.nvidia.keyCooldownMs',
      60_000,
    );
    const invalidKeyCooldownMs = this.positiveConfig(
      'ai.nvidia.invalidKeyCooldownMs',
      600_000,
    );
    const cooldownMs =
      error?.status === 401 || error?.status === 403
        ? invalidKeyCooldownMs
        : Math.max(normalCooldownMs, error?.retryAfterMs ?? 0);
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
}
