import { NotFoundException } from '@nestjs/common';
import { ConversationHistoryService } from './conversation-history.service';

describe('ConversationHistoryService', () => {
  const database = {
    query: jest.fn(),
    queryOne: jest.fn(),
  };
  const service = new ConversationHistoryService(database as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('scopes conversation lists to the authenticated user', async () => {
    database.query.mockResolvedValue([]);

    await service.list(42);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE c.user_id = $1'),
      [42],
    );
  });

  it('restores persisted assistant cards and metadata', async () => {
    database.queryOne.mockResolvedValue({
      conversationId: 7,
      sessionId: 'SES-owned',
      createdAt: new Date('2026-07-26T10:00:00Z'),
      updatedAt: new Date('2026-07-26T10:01:00Z'),
    });
    database.query.mockResolvedValue([
      {
        messageId: 9,
        role: 'assistant',
        content: 'Có ba phương án phù hợp.',
        intent: 'recommend_plots',
        extractedData: { budgetMax: 150_000_000 },
        metadata: {
          agentMetadata: {
            llmModel: 'mistralai/mistral-nemotron',
            fallbackUsed: false,
          },
          recommendations: [{ optionId: 'OPT-001' }],
          suggestedServices: [],
          actions: [],
        },
        createdAt: new Date('2026-07-26T10:01:00Z'),
      },
    ]);

    const result = await service.get(42, 'SES-owned');

    const message = result.messages[0] as any;
    expect(message.response?.recommendations).toEqual([
      { optionId: 'OPT-001' },
    ]);
    expect(message.response?.metadata).toMatchObject({
      fallbackUsed: false,
    });
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('user_id = $2'),
      ['SES-owned', 42],
    );
  });

  it('does not expose a missing or foreign conversation', async () => {
    database.queryOne.mockResolvedValue(null);

    await expect(service.get(99, 'SES-foreign')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes only a conversation owned by the current user', async () => {
    database.queryOne.mockResolvedValue({ sessionId: 'SES-owned' });

    await service.remove(42, 'SES-owned');

    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('session_id = $1 AND user_id = $2'),
      ['SES-owned', 42],
    );
  });
});
