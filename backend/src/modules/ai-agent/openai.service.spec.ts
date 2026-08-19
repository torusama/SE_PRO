import { ConfigService } from '@nestjs/config';
import { EmailDraftAiService, OpenAiService } from './openai.service';

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
      if (key === 'ai.openai.apiKey')
        return '{\n  sk-key1\n  sk-key2\n  sk-key3\n}';
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
        choices: [
          { message: { role: 'assistant', content: 'Success with key2' } },
        ],
      }),
    });

    const result = await service.chat([{ role: 'user', content: 'hi' }]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // First call uses sk-key1
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer sk-key1',
    );
    // Second call automatically switches to sk-key2
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer sk-key2',
    );
    expect(result.choices[0].message.content).toBe('Success with key2');
  });

  it('switches keys when a successful HTTP response has no usable assistant output', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKeys') return 'sk-empty,sk-good';
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.openai.baseUrl') return 'https://api.openai.com/v1';
      return undefined;
    });
    const mockFetch = global.fetch as jest.Mock;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: '   ' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { message: { role: 'assistant', content: 'Có câu trả lời' } },
          ],
        }),
      });

    await expect(
      service.chat([{ role: 'user', content: 'hi' }]),
    ).resolves.toMatchObject({
      choices: [{ message: { content: 'Có câu trả lời' } }],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the same API key inside one user turn and rotates on the next turn', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKey') return undefined;
      if (key === 'ai.openai.apiKeys') return 'sk-key1,sk-key2';
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.openai.baseUrl') return 'https://api.openai.com/v1';
      if (key === 'ai.openai.model') return 'gpt-4o-mini';
      if (key === 'ai.openai.timeoutMs') return 1000;
      if (key === 'ai.openai.totalTimeoutMs') return 2000;
      return null;
    });

    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    }));

    await service.chat([{ role: 'user', content: 'first' }], [], 'auto', {
      routingKey: 'turn-1',
    });
    await service.chat([{ role: 'user', content: 'compose' }], [], 'auto', {
      routingKey: 'turn-1',
    });
    await service.chat([{ role: 'user', content: 'second' }], [], 'auto', {
      routingKey: 'turn-2',
    });

    expect(
      mockFetch.mock.calls.map((call) => call[1].headers.Authorization),
    ).toEqual(['Bearer sk-key1', 'Bearer sk-key1', 'Bearer sk-key2']);
  });

  it('can exhaust more than two fast-failing keys before succeeding', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKeys') return 'key-1,key-2,key-3,key-4';
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.openai.baseUrl') return 'https://api.openai.com/v1';
      if (key === 'ai.openai.model') return 'openai/gpt-oss-20b';
      if (key === 'ai.openai.timeoutMs') return 1000;
      if (key === 'ai.openai.totalTimeoutMs') return 3000;
      if (key === 'ai.openai.maxAttempts') return 10;
      return undefined;
    });
    const mockFetch = global.fetch as jest.Mock;
    for (let index = 0; index < 3; index += 1) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: async () => '',
      });
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'fourth key' } }],
      }),
    });

    await expect(
      service.chat([{ role: 'user', content: 'hi' }]),
    ).resolves.toMatchObject({
      choices: [{ message: { content: 'fourth key' } }],
    });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('can disable model thinking through the OpenAI-compatible request body', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.openai.apiKeys') return 'key-1';
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.openai.baseUrl')
        return 'https://integrate.api.nvidia.com/v1';
      if (key === 'ai.openai.model') return 'nvidia/nemotron-3-nano-30b-a3b';
      return undefined;
    });
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Kết luận.' } }],
      }),
    });

    await service.chat([{ role: 'user', content: 'So sánh' }], [], 'auto', {
      enableThinking: false,
    });

    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('does not divide the first request timeout across every key in a large pool', async () => {
    jest.useFakeTimers();
    try {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'ai.openai.apiKeys')
          return Array.from(
            { length: 10 },
            (_, index) => `key-${index + 1}`,
          ).join(',');
        if (key === 'ai.enableLlm') return true;
        if (key === 'ai.openai.baseUrl') return 'https://api.openai.com/v1';
        if (key === 'ai.openai.timeoutMs') return 6000;
        if (key === 'ai.openai.totalTimeoutMs') return 6000;
        if (key === 'ai.openai.maxAttempts') return 10;
        return undefined;
      });
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('timeout'), { name: 'AbortError' }),
              ),
            );
          }),
      );

      const result = service
        .chat([{ role: 'user', content: 'hi' }])
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(4999);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('EmailDraftAiService', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('records direct dedicated-model tokens, latency and configured cost without double counting router calls', async () => {
    const configService = new ConfigService();
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.emailDraft.apiKeys') return 'email-key-1';
      if (key === 'ai.emailDraft.baseUrl')
        return 'https://integrate.api.nvidia.com/v1';
      if (key === 'ai.emailDraft.model') return 'openai/gpt-oss-20b';
      if (key === 'ai.telemetry.emailDraft.inputUsdPerMillion') return 1;
      if (key === 'ai.telemetry.emailDraft.outputUsdPerMillion') return 2;
      return undefined;
    });
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const service = new EmailDraftAiService(configService, database as never);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'openai/gpt-oss-20b',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
        choices: [{ message: { role: 'assistant', content: 'Email draft' } }],
      }),
    }) as jest.Mock;

    await service.chat([{ role: 'user', content: 'Draft email' }]);
    await Promise.resolve();

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_llm_calls'),
      expect.arrayContaining([
        'email-draft',
        'EmailDraftAiService',
        'openai/gpt-oss-20b',
        'success',
        100,
        50,
        150,
        0.0002,
      ]),
    );

    database.query.mockClear();
    await service.chat(
      [{ role: 'user', content: 'Router-owned call' }],
      [],
      'auto',
      { skipRuntimeTelemetry: true },
    );
    await Promise.resolve();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('uses only the dedicated email key namespace and rotates after a rate limit', async () => {
    const configService = new ConfigService();
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ai.enableLlm') return true;
      if (key === 'ai.emailDraft.apiKey') return undefined;
      if (key === 'ai.emailDraft.apiKeys') return 'email-key-1,email-key-2';
      if (key === 'ai.emailDraft.baseUrl')
        return 'https://integrate.api.nvidia.com/v1';
      if (key === 'ai.emailDraft.model') return 'openai/gpt-oss-20b';
      if (key === 'ai.emailDraft.timeoutMs') return 10000;
      if (key === 'ai.emailDraft.totalTimeoutMs') return 22000;
      if (key === 'ai.emailDraft.maxAttempts') return 3;
      return null;
    });
    const service = new EmailDraftAiService(configService);
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: async () => 'Rate limited',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Email draft' } }],
        }),
      });
    global.fetch = mockFetch;

    const result = await service.chat([
      { role: 'user', content: 'Draft email' },
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer email-key-1',
    );
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer email-key-2',
    );
    expect(result.choices[0].message.content).toBe('Email draft');
  });
});
