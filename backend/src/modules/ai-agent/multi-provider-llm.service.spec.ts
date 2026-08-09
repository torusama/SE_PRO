import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MultiProviderLlmService } from './multi-provider-llm.service';
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import { OpenAiService, OpenAiSecondaryService } from './openai.service';
import { NvidiaChatResponse } from './types/nvidia.types';

describe('MultiProviderLlmService', () => {
  let service: MultiProviderLlmService;
  let configService: ConfigService;
  let openAiPrimary: OpenAiService;
  let openAiSecondary: OpenAiSecondaryService;
  let nvidiaService: NvidiaNemotronService;

  beforeEach(() => {
    configService = new ConfigService();
    openAiPrimary = new OpenAiService(configService);
    openAiSecondary = new OpenAiSecondaryService(configService);
    nvidiaService = new NvidiaNemotronService(configService);
    service = new MultiProviderLlmService(
      configService,
      openAiPrimary,
      openAiSecondary,
      nvidiaService,
    );
  });

  it('throws ServiceUnavailableException when no provider has an API key', async () => {
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(false);

    await expect(service.chat([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('uses 120B first and borrows 20B before the slower agent fallback', async () => {
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
    // Mock Secondary (120B) failure
    jest
      .spyOn(openAiSecondary, 'chat')
      .mockRejectedValue(new Error('OpenAI 120B timeout'));

    jest.spyOn(nvidiaService, 'chat');

    const result = await service.chat([]);

    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
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

  it('uses Mistral only after both GPT-OSS pools fail', async () => {
    const response: NvidiaChatResponse = {
      choices: [
        { message: { role: 'assistant', content: 'Mistral final fallback' } },
      ],
    };
    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);
    jest
      .spyOn(openAiSecondary, 'chat')
      .mockRejectedValue(new Error('120B unavailable'));
    jest
      .spyOn(openAiPrimary, 'chat')
      .mockRejectedValue(new Error('20B unavailable'));
    jest.spyOn(nvidiaService, 'chat').mockResolvedValue(response);

    await expect(service.chat([])).resolves.toEqual(response);
    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).toHaveBeenCalledTimes(1);
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

    expect(openAiSecondary.chat).toHaveBeenCalledTimes(2);
    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).not.toHaveBeenCalled();
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
});
