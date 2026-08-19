import { DatabaseService } from '../../database/database.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';

describe('ConversationMemoryService corrections', () => {
  it('retains a natural complaint that the assistant misunderstood the user', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([]),
    };
    const llm = {
      isConfigured: jest.fn().mockReturnValue(false),
    };
    const service = new ConversationMemoryService(
      database as unknown as DatabaseService,
      llm as unknown as MultiProviderLlmService,
    );

    await service.recordTurnSnapshot({
      conversationId: 10,
      userId: 7,
      userMessage:
        'Bạn bắt trật ý tui, tui đang góp ý cách hoạt động chứ đâu nhờ coi lô.',
      assistantMessage: 'Mình xin lỗi và sẽ sửa lại theo đúng ý bạn.',
      intent: 'general_question',
      requirements: {},
    });

    const upsert = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_conversation_memories'),
    );
    expect(JSON.parse(String(upsert?.[1]?.[6]))).toEqual([
      expect.stringContaining('bắt trật ý'),
    ]);
    expect(llm.isConfigured).toHaveBeenCalled();
  });
});
