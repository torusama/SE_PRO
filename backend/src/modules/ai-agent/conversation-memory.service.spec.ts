import { DatabaseService } from '../../database/database.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';

describe('ConversationMemoryService corrections', () => {
  it('retains a natural complaint that the assistant misunderstood the user', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM ai_messages')) {
          return Promise.resolve([
            {
              role: 'user',
              content:
                'Bạn bắt trật ý tui, tui đang góp ý cách hoạt động chứ đâu nhờ coi lô.',
            },
            {
              role: 'assistant',
              content: 'Mình xin lỗi và sẽ sửa lại theo đúng ý bạn.',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    const llm = {
      isConfigured: jest.fn().mockReturnValue(true),
      model: 'test-model',
      chat: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rollingSummary: 'Khách góp ý cách hoạt động của hệ thống.',
                currentGoal: 'Góp ý hệ thống',
                unresolvedContext: '',
                correctionNotes: ['Khách sửa: muốn góp ý hoạt động chứ không phải coi lô'],
              }),
            },
          },
        ],
      }),
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

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(llm.isConfigured).toHaveBeenCalled();
    expect(llm.chat).toHaveBeenCalled();
    const updateCall = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE ai_conversation_memories'),
    );
    expect(JSON.parse(String(updateCall?.[1]?.[4]))).toEqual([
      expect.stringContaining('góp ý hoạt động'),
    ]);
  });
});
