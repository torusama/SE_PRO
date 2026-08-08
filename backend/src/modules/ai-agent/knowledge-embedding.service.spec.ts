import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';

const vector = () => Array.from({ length: 1024 }, () => 0.25);

function createService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'ai.rag.enabled': true,
    'ai.rag.apiKeys': ['key-a', 'key-b'],
    'ai.rag.model': 'nvidia/llama-nemotron-embed-1b-v2',
    'ai.rag.dimension': 1024,
    'ai.rag.maxAttempts': 2,
    ...overrides,
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const database = {
    query: jest.fn(),
    queryOne: jest.fn(),
  };
  return {
    config,
    database,
    service: new KnowledgeEmbeddingService(
      database as unknown as DatabaseService,
      config as unknown as ConfigService,
    ),
  };
}

describe('KnowledgeEmbeddingService RAG resilience', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses query mode and fails over to a second NVIDIA key on throttling', async () => {
    const { service } = createService();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'busy',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ embedding: vector() }] }),
      }) as jest.Mock;

    await expect(service.embed('  remote   grave care  ')).resolves.toHaveLength(
      1024,
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstOptions = (global.fetch as jest.Mock).mock.calls[0][1];
    const secondOptions = (global.fetch as jest.Mock).mock.calls[1][1];
    expect(firstOptions.headers.Authorization).toBe('Bearer key-a');
    expect(secondOptions.headers.Authorization).toBe('Bearer key-b');
    const requestBody = JSON.parse(firstOptions.body);
    expect(requestBody).toMatchObject({
      model: 'nvidia/llama-nemotron-embed-1b-v2',
      input: ['remote grave care'],
      input_type: 'query',
      truncate: 'END',
      dimensions: 1024,
    });
    expect(requestBody).not.toHaveProperty('modality');
  });

  it('rejects malformed vectors instead of writing incompatible embeddings', async () => {
    const { service } = createService();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    }) as jest.Mock;

    await expect(service.embed('test')).rejects.toThrow(
      'does not match configured 1024',
    );
  });

  it('embeds only active validated entries and stores passage vectors', async () => {
    const { database, service } = createService();
    jest.spyOn(service, 'supportsPgVector').mockResolvedValue(true);
    database.queryOne.mockResolvedValue({ content: 'Approved FAQ content' });
    jest.spyOn(service, 'embed').mockResolvedValue(vector());
    database.query.mockResolvedValue([]);

    await expect(service.embedKnowledgeEntry(73)).resolves.toBe(true);

    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining("validation_status = 'active'"),
      [73],
    );
    expect(service.embed).toHaveBeenCalledWith(
      'Approved FAQ content',
      'passage',
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('embedding = $1::vector'),
      [
        expect.stringMatching(/^\[/),
        'nvidia/llama-nemotron-embed-1b-v2',
        73,
      ],
    );
  });

  it('skips inactive entries and continues a backfill when one provider call fails', async () => {
    const inactive = createService();
    jest.spyOn(inactive.service, 'supportsPgVector').mockResolvedValue(true);
    inactive.database.queryOne.mockResolvedValue(null);
    const inactiveEmbed = jest.spyOn(inactive.service, 'embed');
    await expect(inactive.service.embedKnowledgeEntry(90)).resolves.toBe(false);
    expect(inactiveEmbed).not.toHaveBeenCalled();

    const backfill = createService();
    jest.spyOn(backfill.service, 'supportsPgVector').mockResolvedValue(true);
    backfill.database.query.mockImplementation((sql: string) =>
      sql.includes('SELECT knowledge_entry_id AS id')
        ? [
            { id: 1, content: 'first' },
            { id: 2, content: 'second' },
          ]
        : [],
    );
    jest
      .spyOn(backfill.service, 'embed')
      .mockRejectedValueOnce(new Error('provider busy'))
      .mockResolvedValueOnce(vector());

    await expect(backfill.service.backfillMissingActiveEntries()).resolves.toBe(
      1,
    );
    expect(backfill.database.query).toHaveBeenCalledWith(
      expect.stringContaining('embedding = $1::vector'),
      [
        expect.stringMatching(/^\[/),
        'nvidia/llama-nemotron-embed-1b-v2',
        2,
      ],
    );
  });
});
