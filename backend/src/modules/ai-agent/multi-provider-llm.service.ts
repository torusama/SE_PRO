import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import { OpenAiService, OpenAiSecondaryService } from './openai.service';
import { NvidiaChatResponse, NvidiaMessage } from './types/nvidia.types';

export interface LlmProvider {
  name: string;
  isConfigured: () => boolean;
  model: string;
  chat: (
    messages: NvidiaMessage[],
    tools?: readonly unknown[],
    toolChoice?: unknown,
    options?: { temperature?: number },
  ) => Promise<NvidiaChatResponse>;
}

@Injectable()
export class MultiProviderLlmService {
  private readonly logger = new Logger(MultiProviderLlmService.name);

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
    if (this.openAiPrimary.isConfigured()) return this.openAiPrimary.model;
    if (this.openAiSecondary.isConfigured()) return this.openAiSecondary.model;
    if (this.nvidia.isConfigured()) return this.nvidia.model;
    return 'none';
  }

  getProviders(): LlmProvider[] {
    const providers: LlmProvider[] = [];

    if (this.openAiPrimary.isConfigured()) {
      providers.push({
        name: `OpenAI Primary (${this.openAiPrimary.model})`,
        isConfigured: () => this.openAiPrimary.isConfigured(),
        model: this.openAiPrimary.model,
        chat: (...args) => this.openAiPrimary.chat(...args),
      });
    }

    if (this.openAiSecondary.isConfigured()) {
      providers.push({
        name: `OpenAI Secondary (${this.openAiSecondary.model})`,
        isConfigured: () => this.openAiSecondary.isConfigured(),
        model: this.openAiSecondary.model,
        chat: (...args) => this.openAiSecondary.chat(...args),
      });
    }

    if (this.nvidia.isConfigured()) {
      providers.push({
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
    options: { temperature?: number } = {},
  ): Promise<NvidiaChatResponse> {
    const providers = this.getProviders();

    if (providers.length === 0) {
      this.logger.warn('No AI LLM provider is configured with an API key');
      throw new ServiceUnavailableException(
        'No AI LLM provider is configured with an API key',
      );
    }

    let lastError: unknown;

    for (let i = 0; i < providers.length; i += 1) {
      const provider = providers[i];
      try {
        this.logger.log(
          `[Multi-LLM] Attempting provider ${i + 1}/${providers.length}: ${
            provider.name
          }`,
        );
        const result = await provider.chat(
          messages,
          tools,
          toolChoice,
          options,
        );
        this.logger.log(
          `[Multi-LLM] Provider ${provider.name} succeeded`,
        );
        return result;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[Multi-LLM] Provider ${i + 1}/${providers.length} (${
            provider.name
          }) failed: ${msg}`,
        );

        if (i + 1 < providers.length) {
          this.logger.log(
            `[Multi-LLM] Falling back to next provider: ${
              providers[i + 1].name
            }`,
          );
        }
      }
    }

    throw (
      lastError ||
      new ServiceUnavailableException('All AI LLM providers failed')
    );
  }
}
