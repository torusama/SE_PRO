import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import { OpenAiService, OpenAiSecondaryService } from './openai.service';
import { NvidiaChatResponse, NvidiaMessage } from './types/nvidia.types';

export interface LlmCallOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Stable only for one user turn. The router uses it to keep planner + composer
   * on the same provider/key, while the next turn rotates to a different route.
   */
  routingKey?: string;
  /** Maximum time given to one provider attempt by the outer router. */
  timeoutMs?: number;
  /** Total wall-clock budget for the whole multi-provider call. */
  totalTimeoutMs?: number;
  /** Try this route first, then retain normal cross-provider failover. */
  preferredProviderId?: 'openai-primary' | 'openai-secondary' | 'nvidia';
  /** Keep an auxiliary workload on its dedicated pool and do not borrow chat capacity. */
  strictPreferredProvider?: boolean;
}

export interface LlmProvider {
  id: string;
  name: string;
  isConfigured: () => boolean;
  model: string;
  chat: (
    messages: NvidiaMessage[],
    tools?: readonly unknown[],
    toolChoice?: unknown,
    options?: LlmCallOptions,
  ) => Promise<NvidiaChatResponse>;
}

@Injectable()
export class MultiProviderLlmService {
  private readonly logger = new Logger(MultiProviderLlmService.name);
  private readonly providerCooldownUntil = new Map<string, number>();
  private readonly affinity = new Map<
    string,
    { providerId: string; expiresAt: number }
  >();
  private providerRotationCursor = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly openAiPrimary: OpenAiService,
    private readonly openAiSecondary: OpenAiSecondaryService,
    private readonly nvidia: NvidiaNemotronService,
  ) {}

  isConfigured(): boolean {
    return (
      this.openAiPrimary.isConfigured() ||
      this.openAiSecondary.isConfigured() ||
      this.nvidia.isConfigured()
    );
  }

  get model(): string {
    if (this.openAiSecondary.isConfigured()) return this.openAiSecondary.model;
    if (this.openAiPrimary.isConfigured()) return this.openAiPrimary.model;
    if (this.nvidia.isConfigured()) return this.nvidia.model;
    return 'none';
  }

  getProviders(): LlmProvider[] {
    const providers: LlmProvider[] = [];

    // Main customer chat starts with the deeper 120B model. The 20B pool is
    // borrowed only when 120B fails; suggested follow-ups still target it
    // directly with their own short timeout. Mistral remains the final route.
    if (this.openAiSecondary.isConfigured()) {
      providers.push({
        id: 'openai-secondary',
        name: `OpenAI Secondary (${this.openAiSecondary.model})`,
        isConfigured: () => this.openAiSecondary.isConfigured(),
        model: this.openAiSecondary.model,
        chat: (...args) => this.openAiSecondary.chat(...args),
      });
    }

    if (this.openAiPrimary.isConfigured()) {
      providers.push({
        id: 'openai-primary',
        name: `OpenAI Primary (${this.openAiPrimary.model})`,
        isConfigured: () => this.openAiPrimary.isConfigured(),
        model: this.openAiPrimary.model,
        chat: (...args) => this.openAiPrimary.chat(...args),
      });
    }

    if (this.nvidia.isConfigured()) {
      providers.push({
        id: 'nvidia',
        name: `NVIDIA NIM (${this.nvidia.model})`,
        isConfigured: () => this.nvidia.isConfigured(),
        model: this.nvidia.model,
        chat: (...args) => this.nvidia.chat(...args),
      });
    }

    return providers;
  }

  async chat(
    messages: NvidiaMessage[],
    tools: readonly unknown[] = [],
    toolChoice: unknown = 'auto',
    options: LlmCallOptions = {},
  ): Promise<NvidiaChatResponse> {
    const providers = this.getProviders();

    if (providers.length === 0) {
      this.logger.warn('No AI LLM provider is configured with an API key');
      throw new ServiceUnavailableException(
        'No AI LLM provider is configured with an API key',
      );
    }

    const totalTimeoutMs = this.clampTimeout(
      options.totalTimeoutMs,
      this.positiveConfig('ai.router.totalTimeoutMs', 10_000),
    );
    const providerTimeoutMs = this.clampTimeout(
      options.timeoutMs,
      this.positiveConfig('ai.router.providerTimeoutMs', 6_000),
    );
    const ordered = this.selectProviders(
      providers,
      options.routingKey,
      options.preferredProviderId,
      options.strictPreferredProvider,
    );
    if (!ordered.length) {
      throw new ServiceUnavailableException(
        'All AI providers are temporarily cooling down',
      );
    }

    const deadline = Date.now() + totalTimeoutMs;
    let lastError: unknown;

    for (let i = 0; i < ordered.length; i += 1) {
      const provider = ordered[i];
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) break;

      const hasBackup = i + 1 < ordered.length;
      const reserveForBackup =
        hasBackup && remainingBudgetMs > 3_000
          ? Math.min(1_500, remainingBudgetMs - 1_000)
          : 0;
      const currentBudget = Math.max(
        1_000,
        remainingBudgetMs - reserveForBackup,
      );
      const attemptTimeoutMs = Math.min(providerTimeoutMs, currentBudget);

      try {
        this.logger.log(
          `[Multi-LLM] Attempting provider ${i + 1}/${ordered.length}: ${provider.name}`,
        );
        const result = await provider.chat(messages, tools, toolChoice, {
          ...options,
          routingKey: options.routingKey,
          timeoutMs: attemptTimeoutMs,
          totalTimeoutMs: attemptTimeoutMs,
        });
        this.rememberAffinity(options.routingKey, provider.id);
        this.providerCooldownUntil.delete(provider.id);
        this.logger.log(`[Multi-LLM] Provider ${provider.name} succeeded`);
        return result;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[Multi-LLM] Provider ${i + 1}/${ordered.length} (${provider.name}) failed: ${msg}`,
        );

        if (this.isTransientFailure(error)) {
          this.cooldownProvider(provider.id);
          this.forgetAffinityIfMatches(options.routingKey, provider.id);
        }

        if (i + 1 < ordered.length && Date.now() < deadline) {
          this.logger.log(
            `[Multi-LLM] Failing over to next healthy provider: ${ordered[i + 1].name}`,
          );
        }
      }
    }

    throw (
      lastError ||
      new ServiceUnavailableException('All AI LLM providers failed')
    );
  }

  private selectProviders(
    providers: LlmProvider[],
    routingKey?: string,
    preferredProviderId?: string,
    strictPreferredProvider = false,
  ): LlmProvider[] {
    this.pruneAffinity();
    const now = Date.now();
    const preferredId =
      preferredProviderId ??
      (routingKey ? this.affinity.get(routingKey)?.providerId : undefined);
    const preferredIndex = preferredId
      ? providers.findIndex((provider) => provider.id === preferredId)
      : -1;
    const rotateProviders =
      this.config.get<boolean>('ai.router.rotateProviders') === true;
    const startIndex =
      preferredIndex >= 0
        ? preferredIndex
        : rotateProviders
          ? this.providerRotationCursor % providers.length
          : 0;
    if (preferredIndex < 0 && rotateProviders) {
      this.providerRotationCursor =
        (this.providerRotationCursor + 1) % providers.length;
    }

    const ordered = providers.map(
      (_, offset) => providers[(startIndex + offset) % providers.length],
    );
    const healthy = ordered.filter(
      (provider) => (this.providerCooldownUntil.get(provider.id) ?? 0) <= now,
    );
    return strictPreferredProvider && preferredProviderId
      ? healthy.filter((provider) => provider.id === preferredProviderId)
      : healthy;
  }

  private rememberAffinity(routingKey: string | undefined, providerId: string) {
    if (!routingKey) return;
    this.affinity.set(routingKey, {
      providerId,
      expiresAt: Date.now() + 120_000,
    });
  }

  private forgetAffinityIfMatches(
    routingKey: string | undefined,
    providerId: string,
  ) {
    if (!routingKey) return;
    if (this.affinity.get(routingKey)?.providerId === providerId) {
      this.affinity.delete(routingKey);
    }
  }

  private pruneAffinity() {
    const now = Date.now();
    for (const [key, value] of this.affinity) {
      if (value.expiresAt <= now) this.affinity.delete(key);
    }
  }

  private cooldownProvider(_providerId: string) {
    // Intentionally no provider-wide cooldown. A provider may contain many keys,
    // and cooling the whole route after only a couple of failures caused later
    // messages to skip healthy, untried keys and fall back immediately. Per-key
    // cooldown in each provider service is the correct granularity.
    return;
  }

  private isTransientFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout|network|fetch|socket|connection|econn|429|408|401|403|5\d\d|cooling down|unavailable/i.test(
      message,
    );
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
