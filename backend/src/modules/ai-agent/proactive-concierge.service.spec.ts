import { ProactiveConciergeService } from './proactive-concierge.service';

function createService(overrides?: {
  pending?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  ownedPlots?: Array<Record<string, unknown>>;
  llmConfigured?: boolean;
  llmContent?: string;
}) {
  const database = {
    query: jest.fn((sql: string) => {
      if (sql.includes('FROM ownership_records')) {
        return Promise.resolve(
          overrides?.ownedPlots ?? [{ plotId: 10, plotCode: 'A-01-001' }],
        );
      }
      return Promise.resolve([]);
    }),
    queryOne: jest.fn((sql: string) => {
      if (sql.includes('FROM users')) {
        return Promise.resolve({ fullName: 'An Võ' });
      }
      if (sql.includes('JOIN LATERAL')) {
        return Promise.resolve(overrides?.pending);
      }
      if (sql.includes('FROM service_orders')) {
        return Promise.resolve(undefined);
      }
      if (sql.includes("m.metadata->>'proactiveKey'")) {
        return Promise.resolve(overrides?.previous);
      }
      if (sql.includes('INSERT INTO ai_conversations')) {
        return Promise.resolve({ id: 99 });
      }
      if (sql.includes('INSERT INTO ai_messages')) {
        return Promise.resolve({ id: 101 });
      }
      return Promise.resolve(undefined);
    }),
  };
  const cemeteryServices = {
    serviceTypes: jest.fn().mockResolvedValue([
      {
        id: 3,
        name: 'Dọn dẹp mộ',
        description: 'Vệ sinh phần mộ',
        basePrice: 200_000,
        unit: 'lần',
        category: 'maintenance',
      },
    ]),
  };
  const llm = {
    model: 'test-agent-model',
    isConfigured: jest.fn(() => overrides?.llmConfigured ?? true),
    chat: jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              overrides?.llmContent ??
              'Chào anh An, lô A-01-001 của gia đình đang phù hợp để mình hỗ trợ lên kế hoạch chăm sóc định kỳ. Anh muốn ưu tiên vệ sinh phần mộ hay chuẩn bị hoa tươi cho dịp gần nhất?',
          },
        },
      ],
    }),
  };
  return {
    database,
    cemeteryServices,
    llm,
    service: new ProactiveConciergeService(
      database as never,
      cemeteryServices as never,
      llm as never,
    ),
  };
}

describe('ProactiveConciergeService', () => {
  it('initiates a grounded service conversation for an owned plot', async () => {
    const { service, database, llm } = createService();

    const delivery = await service.initiate(7);

    expect(delivery).toMatchObject({
      delivered: true,
      created: true,
      resumeConversation: false,
      response: {
        intent: 'proactive_concierge',
        suggestedServices: [
          expect.objectContaining({ id: 3, name: 'Dọn dẹp mộ' }),
        ],
      },
    });
    expect(delivery.response?.assistantMessage).toContain('A-01-001');
    expect(delivery.response?.assistantMessage).toContain('Anh muốn');
    expect(delivery.response?.metadata).toMatchObject({
      llmModel: 'test-agent-model',
      fallbackUsed: false,
    });
    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(
      database.queryOne.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_messages'),
      ),
    ).toBe(true);
  });

  it('continues an existing pending service order without asking again', async () => {
    const pendingAction = {
      kind: 'service_order',
      stage: 'collecting',
      serviceTypeId: 3,
      serviceName: 'Dọn dẹp mộ',
      plotId: 10,
      plotCode: 'A-01-001',
    };
    const { service, database } = createService({
      pending: {
        conversationId: 44,
        sessionId: 'SES-PENDING',
        pendingAction,
      },
    });

    const delivery = await service.initiate(7);

    expect(delivery).toMatchObject({
      delivered: true,
      created: true,
      sessionId: 'SES-PENDING',
      response: {
        requirements: { pendingAction },
      },
    });
    expect(
      database.queryOne.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_conversations'),
      ),
    ).toBe(false);
  });

  it('resumes the whole pending conversation when the reminder was already answered', async () => {
    const pendingAction = {
      kind: 'plot_request',
      stage: 'collecting',
      plotIds: [10],
      plotCodes: ['A-01-001'],
    };
    const { service } = createService({
      pending: {
        conversationId: 44,
        sessionId: 'SES-PENDING',
        pendingAction,
      },
      previous: {
        conversationId: 44,
        sessionId: 'SES-PENDING',
        messageId: 80,
        content: 'Mình tiếp tục nhé.',
        intent: 'proactive_concierge',
        extractedData: { pendingAction },
        metadata: {},
        createdAt: new Date(),
        hasFollowup: true,
      },
    });

    await expect(service.initiate(7)).resolves.toMatchObject({
      delivered: true,
      created: false,
      resumeConversation: true,
      sessionId: 'SES-PENDING',
    });
  });

  it('does not emit a canned greeting when no LLM provider is available', async () => {
    const { service, database } = createService({ llmConfigured: false });

    await expect(service.initiate(7)).resolves.toEqual({
      delivered: false,
      reason: 'llm_unavailable',
    });
    expect(
      database.queryOne.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_messages'),
      ),
    ).toBe(false);
  });
});
