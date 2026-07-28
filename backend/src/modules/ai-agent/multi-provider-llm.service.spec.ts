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

  it('falls back through Primary OpenAI (20B) -> Secondary OpenAI (120B) -> NVIDIA NIM', async () => {
    const mockNvidiaResponse: NvidiaChatResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'NVIDIA fallback success',
          },
        },
      ],
    };

    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);

    // Mock Primary (20B) failure
    jest
      .spyOn(openAiPrimary, 'chat')
      .mockRejectedValue(new Error('OpenAI 20B timeout after 15000ms'));

    // Mock Secondary (120B) failure
    jest
      .spyOn(openAiSecondary, 'chat')
      .mockRejectedValue(new Error('OpenAI 120B rate limit 429'));

    // Mock NVIDIA NIM success
    jest.spyOn(nvidiaService, 'chat').mockResolvedValue(mockNvidiaResponse);

    const result = await service.chat([]);

    expect(openAiPrimary.chat).toHaveBeenCalledTimes(1);
    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
    expect(nvidiaService.chat).toHaveBeenCalledTimes(1);
    expect(result.choices[0].message.content).toBe('NVIDIA fallback success');
  });

  it('uses Secondary OpenAI (120B) directly if Primary (20B) key is missing', async () => {
    const mockSecondaryResponse: NvidiaChatResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'OpenAI 120B success',
          },
        },
      ],
    };

    jest.spyOn(openAiPrimary, 'isConfigured').mockReturnValue(false);
    jest.spyOn(openAiSecondary, 'isConfigured').mockReturnValue(true);
    jest.spyOn(nvidiaService, 'isConfigured').mockReturnValue(true);

    jest.spyOn(openAiPrimary, 'chat');
    jest
      .spyOn(openAiSecondary, 'chat')
      .mockResolvedValue(mockSecondaryResponse);

    const result = await service.chat([]);

    expect(openAiPrimary.chat).not.toHaveBeenCalled();
    expect(openAiSecondary.chat).toHaveBeenCalledTimes(1);
    expect(result.choices[0].message.content).toBe('OpenAI 120B success');
  });
});
