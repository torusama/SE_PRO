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


describe('ConversationMemoryService prompt isolation', () => {
  it('supplies a tiny previous-summary window as soft recall without keyword-gating it', async () => {
    const previous = {
      conversationId: 9,
      userId: 7,
      rollingSummary: 'Trước đây khách từng xem lô Khu A với ngân sách 200 triệu.',
      currentGoal: 'So sánh lô cũ',
      unresolvedContext: null,
      recentEntities: { plotCodes: ['A-01-001'] },
      correctionNotes: [],
      lastIntent: 'recommend_plots',
      lastRequirements: { budgetMax: 200_000_000, preferredZone: 'Khu A' },
      lastPendingAction: null,
      lastUserMessage: 'gợi ý lô khu A',
      lastAssistantMessage: 'Đây là các lô khu A.',
      turnCount: 4,
      updatedAt: new Date(),
    };
    const database = {
      queryOne: jest.fn().mockResolvedValue({
        conversationId: 10,
        userId: 7,
        rollingSummary: 'Phiên hiện tại mới bắt đầu.',
        currentGoal: null,
        unresolvedContext: null,
        recentEntities: {},
        correctionNotes: [],
        lastIntent: 'general_question',
        lastRequirements: {},
        lastPendingAction: null,
        lastUserMessage: 'alo',
        lastAssistantMessage: 'xin chào',
        turnCount: 1,
        updatedAt: new Date(),
      }),
      query: jest.fn().mockResolvedValue([previous]),
    };
    const service = new ConversationMemoryService(
      database as unknown as DatabaseService,
      { isConfigured: jest.fn().mockReturnValue(false) } as unknown as MultiProviderLlmService,
    );

    const context = await service.getPromptContext(
      10,
      7,
      'tìm lô cho ông bà ở quê',
    );

    expect(context).toContain('CURRENT_CONVERSATION_MEMORY');
    expect(context).toContain('RECENT_USER_CONVERSATION_SUMMARIES');
    expect(context).toContain('SOFT recall hints');
    expect(context).toContain('Topic overlap alone is NOT continuity');
    // Compact summaries must not copy the previous raw hard requirements or
    // raw messages into a fresh turn.
    expect(context).not.toContain('Last structured requirements');
    expect(context).not.toContain('Last user message: gợi ý lô khu A');
    expect(String(database.query.mock.calls[0]?.[0])).toContain('LIMIT 2');
  });

  it('can expose a novel natural reference to old context without maintaining a phrase keyword list', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([
        {
          conversationId: 8,
          userId: 7,
          rollingSummary: 'Khách đã so sánh A-01-001 và A-01-002.',
          currentGoal: 'Chọn giữa hai lô',
          unresolvedContext: null,
          recentEntities: { plotCodes: ['A-01-001', 'A-01-002'] },
          correctionNotes: [],
          lastIntent: 'recommend_plots',
          lastRequirements: {},
          lastPendingAction: null,
          lastUserMessage: null,
          lastAssistantMessage: null,
          turnCount: 3,
          updatedAt: new Date(),
        },
      ]),
    };
    const service = new ConversationMemoryService(
      database as unknown as DatabaseService,
      { isConfigured: jest.fn().mockReturnValue(false) } as unknown as MultiProviderLlmService,
    );

    const context = await service.getPromptContext(
      10,
      7,
      'bữa bữa mình đang cân hai cái nào ấy nhỉ?',
    );

    expect(context).toContain('A-01-001');
    expect(context).toContain('A-01-002');
  });
});
