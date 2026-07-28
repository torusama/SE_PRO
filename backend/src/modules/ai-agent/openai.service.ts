import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaChatResponse, NvidiaMessage } from './types/nvidia.types';

class OpenAiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`OpenAI HTTP ${status}`);
  }
}

@Injectable()
export class OpenAiService {
  protected readonly logger: Logger;
  private readonly cooldownUntil = new Map<string, number>();
  private rotationCursor = 0;

  constructor(protected readonly config: ConfigService) {
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
    options: { temperature?: number } = {},
  ): Promise<NvidiaChatResponse> {
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
    const timeoutMs =
      this.config.get<number>(`${this.configPrefix}.timeoutMs`) || 15_000;
    const maxAttempts = Math.min(apiKeys.length, 3);

    const body = {
      model: this.model,
      messages,
      temperature:
        options.temperature ??
        this.config.get<number>('ai.nvidia.temperature') ??
        0.2,
      max_tokens: this.config.get<number>('ai.nvidia.maxTokens') ?? 2048,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
    };

    const candidates = this.selectCandidates(apiKeys, maxAttempts);
    let lastError: unknown;

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const candidate = candidates[attempt];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          const errorText = await response.text().catch(() => '');
          throw new OpenAiHttpError(
            response.status,
            this.retryAfterMs(response.headers.get('retry-after')),
          );
        }

        const payload = (await response.json()) as NvidiaChatResponse;
        if (!payload.choices?.[0]?.message) {
          throw new ServiceUnavailableException(
            'OpenAI API returned an invalid response',
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
          error instanceof OpenAiHttpError &&
          (error.status === 429 || error.status >= 500);

        if (isTimeout || isNetworkFailure || retryableHttp) {
          this.cooldownKey(
            candidate.apiKey,
            error instanceof OpenAiHttpError ? error : undefined,
          );
          this.logger.warn(
            `OpenAI attempt ${attempt + 1}/${candidates.length} failed on key slot ${candidate.slot + 1}; ${
              isTimeout
                ? 'timeout'
                : error instanceof Error
                  ? error.message
                  : String(error)
            }`,
          );

          if (attempt + 1 < candidates.length) {
            continue;
          }
        }

        if (error instanceof ServiceUnavailableException) throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    throw (
      lastError ||
      new ServiceUnavailableException(
        `All OpenAI API key attempts failed for provider (${this.configPrefix})`,
      )
    );
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
      // Accept simple multiline block wrapped in {} or [].
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

  private cooldownKey(apiKey: string, error?: OpenAiHttpError) {
    const normalCooldownMs = 60_000;
    const invalidKeyCooldownMs = 600_000;
    const isAuthFailure = error?.status === 401 || error?.status === 403;
    const cooldownMs = isAuthFailure
      ? invalidKeyCooldownMs
      : (error?.retryAfterMs ?? normalCooldownMs);
    this.cooldownUntil.set(apiKey, Date.now() + cooldownMs);
  }

  private retryAfterMs(headerValue?: string | null) {
    if (!headerValue) return undefined;
    const seconds = Number(headerValue);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
    const absoluteTime = Date.parse(headerValue);
    if (!Number.isNaN(absoluteTime)) {
      return Math.max(0, absoluteTime - Date.now());
    }
    return undefined;
  }
}

@Injectable()
export class OpenAiSecondaryService extends OpenAiService {
  protected override get configPrefix(): string {
    return 'ai.openaiSecondary';
  }
}
