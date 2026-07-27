import { ConfigService } from '@nestjs/config';
import { OpenAiService } from './openai.service';

describe('OpenAiService', () => {
  let service: OpenAiService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
    service = new OpenAiService(configService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns isConfigured=false when OPENAI_API_KEY and OPENAI_API_KEYS are missing or empty', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKey') return '';
      if (key === 'ai.openai.apiKeys') return '';
      if (key === 'ai.enableLlm') return true;
      return null;
    });

    expect(service.isConfigured()).toBe(false);
    expect(service.getConfiguredApiKeys()).toEqual([]);
  });

  it('parses multiple keys from OPENAI_API_KEY multiline / comma separated string', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKey') return '{\n  sk-key1\n  sk-key2\n  sk-key3\n}';
      if (key === 'ai.enableLlm') return true;
      return null;
    });

    expect(service.isConfigured()).toBe(true);
    expect(service.getConfiguredApiKeys()).toEqual([
      'sk-key1',
      'sk-key2',
      'sk-key3',
    ]);
  });

  it('automatically switches to key slot 2 if key slot 1 fails with 429 rate limit', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKey') return '{\n  sk-key1\n  sk-key2\n}';
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.openai.baseUrl') return 'https://api.openai.com/v1';
      if (key === 'ai.openai.model') return 'gpt-4o-mini';
      return null;
    });

    const mockFetch = global.fetch as jest.Mock;

    // Slot 1 (sk-key1) fails with 429
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => '10' },
      text: async () => 'Rate limit exceeded',
    });

    // Slot 2 (sk-key2) succeeds with 200
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Success with key2' } }],
      }),
    });

    const result = await service.chat([{ role: 'user', content: 'hi' }]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // First call uses sk-key1
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-key1');
    // Second call automatically switches to sk-key2
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer sk-key2');
    expect(result.choices[0].message.content).toBe('Success with key2');
  });
});
