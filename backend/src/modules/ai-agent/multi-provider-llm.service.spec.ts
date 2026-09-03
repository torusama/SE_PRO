import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MultiProviderLlmService } from './multi-provider-llm.service';
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import {
  ComparisonAiService,
  GroqGptOss20bService,
  GroqGptOss120bService,
  GroqQwen38Service,
  OpenAiService,
  OpenAiSecondaryService,
} from './openai.service';
import { NvidiaChatResponse } from './types/nvidia.types';

describe('MultiProviderLlmService', () => {
  let service: MultiProviderLlmService;
  let configService: ConfigService;
  let openAiPrimary: OpenAiService;
  let openAiSecondary: OpenAiSecondaryService;
  let nvidiaService: NvidiaNemotronService;
  let fastComparison: ComparisonAiService;
  let groq20b: GroqGptOss20bService;
  let groq120b: GroqGptOss120bService;
  let groqQwen38: GroqQwen38Service;

  beforeEach(() => {
    configService = new ConfigService();
    openAiPrimary = new OpenAiService(configService);
    openAiSecondary = new OpenAiSecondaryService(configService);
    nvidiaService = new NvidiaNemotronService(configService);
    fastComparison = new ComparisonAiService(configService);
    groq20b = new GroqGptOss20bService(configService);
    groq120b = new GroqGptOss120bService(configService);
    groqQwen38 = new GroqQwen38Service(configService);
    service = new MultiProviderLlmService(
      configService,
      openAiPrimary,
      openAiSecondary,
      nvidiaService,
      undefined,
      fastComparison,
      groq20b,
      groq120b,
      groqQwen38,
    );
  });

  it('throws ServiceUnavailableException when no provider has an API key', async () => {
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(false);

    await expect(service.chat([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('prioritizes the three independent Groq pools before NVIDIA fallbacks', async () => {
    const response: NvidiaChatResponse = {
      choices: [
        { message: { role: 'assistant', content: 'Groq 20B winner' } },
      ],
    };
    jest.spyOn(groq20b, 'isConfigured').mockReturnValue(true);
    jest.spyOn(groq120b, 'isConfigured').mockReturnValue(true);
    jest.spyOn(groqQwen38, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    const first = jest.spyOn(groq20b, 'chat').mockResolvedValue(response);
    const second = jest.spyOn(groq120b, 'chat');
    const third = jest.spyOn(groqQwen38, 'chat');
    const nvidiaFallback = jest.spyOn(openAiPrimary, 'chat');

    await expect(service.chat([])).resolves.toEqual(response);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();
    expect(nvidiaFallback).not.toHaveBeenCalled();
    expect(service.model).toBe(groq20b.model);
  });

  it('uses the responsive 20B route before the slower model fallbacks', async () => {
    const mockPrimaryResponse: NvidiaChatResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: '20B fallback success',
          },
        },
      ],
    };

    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);

    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(mockPrimaryResponse);
    jest.spyOn(openAiSecondary, 'chat');

    jest.spyOn(nvidiaService, 'chat');

    const result = await service.chat([]);

    expect(openAiSecondary.chat).not.toHaveBeenCalled();
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).not.toHaveBeenCalled();
    expect(result.choices[0].message.content).toBe('20B fallback success');
  });

  it('uses 20B directly if the 120B pool is missing', async () => {
    const mockNvidiaResponse: NvidiaChatResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: '20B success',
          },
        },
      ],
    };

    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);

    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(mockNvidiaResponse);
    jest.spyOn(openAiSecondary, 'chat');
    jest.spyOn(nvidiaService, 'chat');

    const result = await service.chat([]);

    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).not.toHaveBeenCalled();
    expect(openAiSecondary.chat).not.toHaveBeenCalled();
    expect(result.choices[0].message.content).toBe('20B success');
  });

  it('uses the responsive Nemotron fallback before the stalled 120B route', async () => {
    const response: NvidiaChatResponse = {
      choices: [
        { message: { role: 'assistant', content: 'Mistral final fallback' } },
      ],
    };
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'chat');
    jest
      .spyOn(openAiPrimary, 'chat')
      .mockRejectedValue(new Error('20B unavailable'));
    jest.spyOn(nvidiaService, 'chat').mockResolvedValue(response);

    await expect(service.chat([])).resolves.toEqual(response);
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).toHaveBeenCalledTimes(1);
    expect(openAiSecondary.chat).not.toHaveBeenCalled();
  });

  it('fails over when a provider returns an empty assistant message', async () => {
    const empty: NvidiaChatResponse = {
      choices: [{ message: { role: 'assistant', content: '   ' } }],
    };
    const usable: NvidiaChatResponse = {
      choices: [{ message: { role: 'assistant', content: 'usable output' } }],
    };
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(false);
    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(empty);
    jest.spyOn(openAiSecondary, 'chat').mockResolvedValue(usable);

    await expect(service.chat([])).resolves.toEqual(usable);
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
  });

  it('fails over when workload validation rejects a non-empty response', async () => {
    const invalid: NvidiaChatResponse = {
      choices: [{ message: { role: 'assistant', content: 'not valid JSON' } }],
    };
    const usable: NvidiaChatResponse = {
      choices: [
        { message: { role: 'assistant', content: '{"intent":"general"}' } },
      ],
    };
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(false);
    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(invalid);
    jest.spyOn(openAiSecondary, 'chat').mockResolvedValue(usable);

    await expect(
      service.chat([], [], 'auto', {
        validateResponse: (response) =>
          response.choices[0]?.message?.content?.trim().startsWith('{') === true,
      }),
    ).resolves.toEqual(usable);
    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
  });

  it('keeps one provider for a user turn and rotates the next user turn', async () => {
    const response = (content: string): NvidiaChatResponse => ({
      choices: [{ message: { role: 'assistant', content } }],
    });

    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(configService, 'get')
      .mockImplementation((key: string) =>
        key === 'ai.router.rotateProviders' ? true : undefined,
      );
    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(response('primary'));
    jest
      .spyOn(openAiSecondary, 'chat')
      .mockResolvedValue(response('secondary'));
    jest.spyOn(nvidiaService, 'chat').mockResolvedValue(response('nvidia'));

    await service.chat([], [], 'auto', { routingKey: 'turn-1' });
    await service.chat([], [], 'auto', { routingKey: 'turn-1' });
    await service.chat([], [], 'auto', { routingKey: 'turn-2' });

    expect(openAiPrimary.chat).toHaveBeenCalledTimes(2);
    expect(nvidiaService.chat).toHaveBeenCalledTimes(1);
    expect(openAiSecondary.chat).not.toHaveBeenCalled();
  });

  it('honors an explicit preferred model while preserving backup failover', async () => {
    const response = (content: string): NvidiaChatResponse => ({
      choices: [{ message: { role: 'assistant', content } }],
    });
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(configService, 'get')
      .mockImplementation((key: string) =>
        key === 'ai.router.rotateProviders' ? true : undefined,
      );
    jest.spyOn(openAiPrimary, 'chat').mockResolvedValue(response('20b'));
    jest.spyOn(openAiSecondary, 'chat').mockResolvedValue(response('120b'));
    jest.spyOn(nvidiaService, 'chat').mockResolvedValue(response('nvidia'));

    const result = await service.chat([], [], 'auto', {
      preferredProviderId: 'openai-primary',
    });

    expect(result.choices[0].message.content).toBe('20b');
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(openAiSecondary.chat).not.toHaveBeenCalled();
  });

  it('keeps a dedicated auxiliary workload on its preferred provider only', async () => {
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    const primaryChat = jest
      .spyOn(openAiPrimary, 'chat')
      .mockRejectedValue(new Error('20B busy'));
    const secondaryChat = jest.spyOn(openAiSecondary, 'chat');
    const nvidiaChat = jest.spyOn(nvidiaService, 'chat');

    await expect(
      service.chat([], [], 'auto', {
        preferredProviderId: 'openai-primary',
        strictPreferredProvider: true,
        timeoutMs: 1_500,
        totalTimeoutMs: 1_800,
      }),
    ).rejects.toThrow('20B busy');

    expect(primaryChat).toHaveBeenCalledTimes(1);
    expect(secondaryChat).not.toHaveBeenCalled();
    expect(nvidiaChat).not.toHaveBeenCalled();
  });

  it('starts a backup after the hedge delay and aborts the slower request', async () => {
    jest.useFakeTimers();
    try {
      const response: NvidiaChatResponse = {
        choices: [
          { message: { role: 'assistant', content: 'fast hedge winner' } },
        ],
      };
      let primaryWasAborted = false;
      jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
      jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
      jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(openAiPrimary, 'chat').mockImplementation((...args: any[]) => {
        const signal = args[3]?.signal as AbortSignal | undefined;
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            primaryWasAborted = true;
            reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
          });
        });
      });
      const nvidia = jest
        .spyOn(nvidiaService, 'chat')
        .mockResolvedValue(response);
      const secondary = jest.spyOn(openAiSecondary, 'chat');

      const result = service.chat([], [], 'auto', {
        timeoutMs: 5_000,
        totalTimeoutMs: 5_000,
      });
      await jest.advanceTimersByTimeAsync(899);
      expect(nvidia).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);

      await expect(result).resolves.toEqual(response);
      expect(primaryWasAborted).toBe(true);
      expect(nvidia).toHaveBeenCalledTimes(1);
      expect(secondary).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rotates provider key pools for a second bounded round', async () => {
    const response: NvidiaChatResponse = {
      choices: [
        { message: { role: 'assistant', content: 'second key round winner' } },
      ],
    };
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    const primary = jest
      .spyOn(openAiPrimary, 'chat')
      .mockRejectedValueOnce(new Error('first primary key failed'))
      .mockResolvedValueOnce(response);
    const nvidia = jest
      .spyOn(nvidiaService, 'chat')
      .mockRejectedValueOnce(new Error('first nvidia key failed'));

    await expect(
      service.chat([], [], 'auto', {
        timeoutMs: 5_000,
        totalTimeoutMs: 5_000,
      }),
    ).resolves.toEqual(response);
    expect(primary).toHaveBeenCalledTimes(2);
    expect(nvidia).toHaveBeenCalledTimes(1);
  });

  it('reserves a fair timeout share so the third model can still return final text', async () => {
    jest.useFakeTimers();
    try {
      const response: NvidiaChatResponse = {
        choices: [{ message: { role: 'assistant', content: '120B final' } }],
      };
      jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
      jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
      jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
      const timeoutFailure = (...args: any[]) =>
        new Promise<never>((_resolve, reject) => {
          const timeoutMs = Number(args[3]?.timeoutMs ?? 0);
          setTimeout(() => reject(new Error('provider timeout')), timeoutMs);
        });
      jest.spyOn(openAiPrimary, 'chat').mockImplementation(timeoutFailure);
      jest.spyOn(nvidiaService, 'chat').mockImplementation(timeoutFailure);
      const secondary = jest
        .spyOn(openAiSecondary, 'chat')
        .mockResolvedValue(response);

      const result = service.chat([], [], 'auto', {
        timeoutMs: 9_000,
        totalTimeoutMs: 9_000,
      });
      await jest.advanceTimersByTimeAsync(3_000);
      expect(nvidiaService.chat).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(3_000);
      await expect(result).resolves.toEqual(response);
      expect(secondary).toHaveBeenCalledTimes(1);
      expect(secondary.mock.calls[0][3]?.timeoutMs).toBeGreaterThanOrEqual(2_900);
    } finally {
      jest.useRealTimers();
    }
  });
});
