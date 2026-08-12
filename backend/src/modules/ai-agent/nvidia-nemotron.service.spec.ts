import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaNemotronService } from './nvidia-nemotron.service';

describe('NvidiaNemotronService', () => {
  const defaultConfigValues: Record<string, unknown> = {
    'ai.enableLlm': true,
    'ai.mistralAgent.apiKey': 'test-key',
    'ai.mistralAgent.apiKeys': undefined,
    'ai.mistralAgent.baseUrl': 'https://nvidia.test/v1',
    'ai.mistralAgent.model': 'mistralai/mistral-nemotron',
    'ai.mistralAgent.timeoutMs': 50,
    'ai.mistralAgent.totalTimeoutMs': 100,
    'ai.mistralAgent.maxAttempts': 3,
    'ai.mistralAgent.keyCooldownMs': 60_000,
    'ai.mistralAgent.invalidKeyCooldownMs': 600_000,
    'ai.mistralAgent.temperature': 0.2,
    'ai.mistralAgent.maxTokens': 100,
  };
  const messages = [{ role: 'user' as const, content: 'Xin chao' }];

  const createService = (overrides: Record<string, unknown> = {}) => {
    const values = { ...defaultConfigValues, ...overrides };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new NvidiaNemotronService(config);
  };

  const okResponse = () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'OK' } }],
      }),
      { status: 200 },
    );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a valid OpenAI-compatible response', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    const service = createService();

    await expect(service.chat(messages, [])).resolves.toMatchObject({
      choices: [{ message: { content: 'OK' } }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nvidia.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    if (typeof request.body !== 'string') throw new Error('Missing body');
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
  });

  it('does not treat embedding keys as Mistral agent keys', () => {
    const service = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': undefined,
      'ai.rag.apiKeys': 'embedding-only',
    });

    expect(service.isConfigured()).toBe(false);
  });

  it('sends a forced named tool choice when requested', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    const service = createService();
    const toolChoice = {
      type: 'function',
      function: { name: 'plan_cemetery_concierge_action' },
    };

    await service.chat(messages, [{ type: 'function' }], toolChoice);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    if (typeof request.body !== 'string') throw new Error('Missing body');
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body.tool_choice).toEqual(toolChoice);
  });

  it('does not retry a request error that another key cannot fix', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 400 }));
    const service = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });

    await expect(service.chat(messages)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses configured keys in round-robin order across chat calls', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => Promise.resolve(okResponse()));
    const service = createService({
      'ai.mistralAgent.apiKey': `{
        key-one
        key-two
        key-three
      }`,
      'ai.mistralAgent.apiKeys': undefined,
    });

    await service.chat(messages);
    await service.chat(messages);
    await service.chat(messages);

    const authorizations = fetchMock.mock.calls.map((call) => {
      const request = call[1] as RequestInit;
      return (request.headers as Record<string, string>).Authorization;
    });
    expect(authorizations).toEqual([
      'Bearer key-one',
      'Bearer key-two',
      'Bearer key-three',
    ]);
  });

  it('fails over after rate limiting or invalid credentials', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'retry-after': '30' } }),
      )
      .mockResolvedValueOnce(okResponse());
    const service = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });

    await expect(service.chat(messages)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(
      (secondRequest.headers as Record<string, string>).Authorization,
    ).toBe('Bearer key-two');

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(okResponse());
    const freshService = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });
    await expect(freshService.chat(messages)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rotates to the next key when HTTP succeeds with empty content', async () => {
    const emptyResponse = new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: null } }],
      }),
      { status: 200 },
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce(okResponse());
    const service = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-empty,key-good',
    });

    await expect(service.chat(messages)).resolves.toMatchObject({
      choices: [{ message: { content: 'OK' } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails over after timeout, network failure, or server error', async () => {
    const timeoutError = Object.assign(new Error('timeout'), {
      name: 'AbortError',
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(okResponse());
    const service = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });

    await expect(service.chat(messages)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse());
    const networkService = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });
    await expect(networkService.chat(messages)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(okResponse());
    const serverErrorService = createService({
      'ai.mistralAgent.apiKey': undefined,
      'ai.mistralAgent.apiKeys': 'key-one,key-two',
    });
    await expect(serverErrorService.chat(messages)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('supports one legacy key without retrying the same key twice', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    const service = createService();

    await expect(service.chat(messages)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives the first request a usable timeout with a large key pool', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('timeout'), { name: 'AbortError' }),
              ),
            );
          }),
      );
      const service = createService({
        'ai.mistralAgent.apiKey': undefined,
        'ai.mistralAgent.apiKeys': Array.from(
          { length: 10 },
          (_, index) => `key-${index + 1}`,
        ).join(','),
        'ai.mistralAgent.timeoutMs': 6000,
        'ai.mistralAgent.totalTimeoutMs': 6000,
        'ai.mistralAgent.maxAttempts': 10,
      });

      const result = service.chat(messages).catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(4999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
