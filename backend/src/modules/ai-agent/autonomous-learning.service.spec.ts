import { DatabaseService } from '../../database/database.service';
import { AutonomousLearningService } from './autonomous-learning.service';
import { AgentToolContext, MemoryProposal } from './tools/agent-tool.types';

interface FakeOptions {
  source?: string | null;
  duplicateId?: number;
  current?: Record<string, unknown> | null;
  insertedId?: number;
  signalId?: number;
  run?: Record<string, unknown> | null;
  failTransaction?: boolean;
}

function setup(options: FakeOptions = {}) {
  const client = {
    query: jest.fn((sql: string): { rows: Record<string, unknown>[] } => {
      if (sql.includes('SELECT content') && sql.includes('FROM ai_messages')) {
        return {
          rows:
            options.source === null
              ? []
              : [
                  {
                    content:
                      options.source ??
                      'Please remember that I prefer plots near the entrance.',
                  },
                ],
        };
      }
      if (
        sql.includes('FROM ai_learning_signals') &&
        sql.includes('SELECT signal_id')
      ) {
        return { rows: [] };
      }
      if (sql.includes('FROM ai_recommendation_runs')) {
        return { rows: options.run ? [options.run] : [] };
      }
      if (
        sql.includes('content_hash = $3') &&
        sql.includes('FROM ai_knowledge_entries')
      ) {
        return {
          rows: options.duplicateId ? [{ id: options.duplicateId }] : [],
        };
      }
      if (
        sql.includes('FROM ai_knowledge_entries') &&
        sql.includes('ORDER BY updated_at DESC')
      ) {
        return { rows: options.current ? [options.current] : [] };
      }
      if (
        sql.includes('FROM ai_knowledge_entries') &&
        sql.includes('ORDER BY effective_from DESC')
      ) {
        return { rows: options.current ? [options.current] : [] };
      }
      if (sql.includes('INSERT INTO ai_knowledge_entries')) {
        return { rows: [{ id: options.insertedId ?? 100 }] };
      }
      if (sql.includes('INSERT INTO ai_learning_signals')) {
        return { rows: [{ id: options.signalId ?? 200 }] };
      }
      if (sql.includes('MAX(version_number)')) {
        return { rows: [{ versionNumber: 1 }] };
      }
      return { rows: [] };
    }),
  };
  const database = {
    transaction: jest.fn(
      async (
        callback: (transactionClient: typeof client) => Promise<unknown>,
      ) => {
        if (options.failTransaction) throw new Error('database unavailable');
        return callback(client);
      },
    ),
  };
  return {
    client,
    database,
    service: new AutonomousLearningService(
      database as unknown as DatabaseService,
    ),
  };
}

const context = (
  overrides: Partial<AgentToolContext> = {},
): AgentToolContext => ({
  conversationId: 10,
  sourceMessageId: 20,
  userId: 5,
  role: 'customer',
  sessionId: 'SES-1',
  ...overrides,
});

const preference = (
  overrides: Partial<MemoryProposal> = {},
): MemoryProposal => ({
  memoryType: 'user_preference',
  category: 'plot_location',
  title: 'Preferred plot location',
  content: 'My family prefers plots near the entrance.',
  requestedScope: 'global',
  memoryKey: 'preferred_plot_location',
  reason: 'Explicit reusable preference',
  ...overrides,
});

describe('AutonomousLearningService', () => {
  it('stores an explicit preference only for the authenticated owner', async () => {
    const { client, service } = setup({ insertedId: 101 });

    const result = await service.processProposal(
      preference({ title: 'preferred plot location' }),
      context(),
    );

    expect(result).toMatchObject({
      status: 'saved_user_memory',
      knowledgeEntryId: 101,
    });
    const insert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_knowledge_entries'),
    );
    expect(insert?.[1]).toEqual(
      expect.arrayContaining([
        'Preferred plot location',
        5,
        'preferred_plot_location',
        'customer',
      ]),
    );
    expect(String(insert?.[0])).toContain("'user'");
    expect(String(insert?.[0])).toContain("'user_preference'");
  });

  it('rejects a current Bát Tự request that the planner mislabeled as lasting memory', async () => {
    const { client, service } = setup({
      source: 'Mình muốn xem Bát Tự theo ngày sinh.',
    });

    const result = await service.processProposal(
      preference({
        category: 'Chủ đề tư vấn',
        title: 'Ưu tiên Bát Tự',
        content: 'Người dùng muốn xem Bát Tự.',
        memoryKey: 'consultation_topic_preference',
      }),
      context(),
    );

    expect(result.status).toBe('rejected');
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_entries'),
      ),
    ).toBe(false);
  });

  it('stores a Bát Tự consultation preference only when its future scope is explicit', async () => {
    const { service } = setup({
      source: 'Từ giờ hãy nhớ ưu tiên góc nhìn Bát Tự khi tư vấn cho mình.',
      insertedId: 102,
    });

    const result = await service.processProposal(
      preference({
        category: 'Chủ đề tư vấn',
        title: 'Ưu tiên Bát Tự',
        content: 'Từ giờ người dùng ưu tiên góc nhìn Bát Tự khi được tư vấn.',
        memoryKey: 'consultation_topic_preference',
      }),
      context(),
    );

    expect(result).toMatchObject({
      status: 'saved_user_memory',
      knowledgeEntryId: 102,
    });
  });

  it('keeps the same preference separate for two users', async () => {
    const { client, service } = setup();

    await service.processProposal(preference(), context({ userId: 5 }));
    await service.processProposal(preference(), context({ userId: 6 }));

    const inserts = client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO ai_knowledge_entries'),
    );
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]?.[4]).toBe(5);
    expect(inserts[1][1]?.[4]).toBe(6);
    expect(inserts[0][1]?.[11]).not.toBe(inserts[1][1]?.[11]);
  });

  it('returns duplicate without creating another active record', async () => {
    const { client, service } = setup({ duplicateId: 77 });

    const result = await service.processProposal(preference(), context());

    expect(result).toMatchObject({
      status: 'duplicate',
      knowledgeEntryId: 77,
    });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_entries'),
      ),
    ).toBe(false);
  });

  it('supersedes a replaced preference and writes versions plus audit atomically', async () => {
    const current = {
      id: 40,
      category: 'plot_location',
      title: 'Near entrance',
      content: 'I prefer plots near the entrance.',
      knowledgeType: 'user_preference',
      scope: 'user',
      ownerUserId: 5,
      memoryKey: 'preferred_plot_location',
      validationStatus: 'active',
      effectiveFrom: null,
      effectiveTo: null,
      isActive: true,
    };
    const { client, database, service } = setup({
      source: 'I now prefer a quieter zone.',
      current,
      insertedId: 41,
    });

    const result = await service.processProposal(
      preference({
        title: 'Quiet location',
        content: 'I now prefer a quieter zone.',
      }),
      context(),
    );

    expect(result).toMatchObject({
      status: 'saved_user_memory',
      knowledgeEntryId: 41,
    });
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("validation_status = 'superseded'"),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_versions'),
      ),
    ).toHaveLength(2);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO audit_logs'),
      ),
    ).toBe(true);
  });

  it('does not create permanent anonymous user memory', async () => {
    const { database, service } = setup();

    const result = await service.processProposal(
      preference(),
      context({ userId: null, role: null }),
    );

    expect(result.status).toBe('login_required');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('rejects sensitive psychological, religious, or medical profiling', async () => {
    const { client, service } = setup({
      source: 'Please remember that I have anxiety and follow this religion.',
    });

    const result = await service.processProposal(
      preference({
        content:
          'The user has anxiety, follows a religion, and has a medical condition.',
      }),
      context(),
    );

    expect(result.status).toBe('rejected');
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_entries'),
      ),
    ).toBe(false);
  });

  it('quarantines a customer-provided business rule even when user scope is requested', async () => {
    const { client, service } = setup({ insertedId: 301 });
    const result = await service.processProposal(
      {
        memoryType: 'business_rule',
        category: 'promotion',
        title: 'Four plot promotion',
        content: 'Buying four plots includes free cleaning.',
        requestedScope: 'user',
        reason: 'Customer claim',
      },
      context(),
    );

    expect(result.status).toBe('stored_for_validation');
    const insert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_knowledge_entries'),
    );
    expect(String(insert?.[0])).toContain("'global'");
    expect(insert?.[1]?.[7]).toBe('quarantined');
    expect(insert?.[1]?.[14]).toBe(false);
  });

  it('activates and audits a validated rule from the trusted admin role', async () => {
    const { client, service } = setup({
      source:
        'The support team reviews submitted service requests before scheduling.',
      insertedId: 302,
    });
    const result = await service.processProposal(
      {
        memoryType: 'business_rule',
        category: 'service_request_review',
        title: 'Service request review process',
        content:
          'The support team reviews submitted service requests before scheduling.',
        requestedScope: 'global',
        reason: 'Administrator announcement',
        effectiveFrom: '2026-08-01',
      },
      context({ role: 'admin', userId: 9 }),
    );

    expect(result.status).toBe('verified_and_activated');
    const insert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_knowledge_entries'),
    );
    expect(insert?.[1]?.[7]).toBe('active');
    expect(insert?.[1]?.[10]).toBe('admin');
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_versions'),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO audit_logs'),
      ),
    ).toBe(true);
  });

  it('rejects a trusted-admin chat proposal that attempts to change runtime policy', async () => {
    const { client, service } = setup({
      source:
        'Khách VIP được ưu tiên lô đẹp nhất và không cần thanh toán trước.',
    });

    const result = await service.processProposal(
      {
        memoryType: 'business_rule',
        category: 'vip_priority',
        title: 'VIP priority without prepayment',
        content:
          'Khách VIP được ưu tiên lô đẹp nhất và không cần thanh toán trước.',
        requestedScope: 'global',
        reason: 'Administrator chat instruction',
      },
      context({ role: 'admin', userId: 9 }),
    );

    expect(result.status).toBe('rejected');
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_entries'),
      ),
    ).toBe(false);
  });

  it('always quarantines natural-language information corrections', async () => {
    const { service } = setup();
    const result = await service.processProposal(
      {
        memoryType: 'information_correction',
        category: 'plot_status',
        title: 'Claimed plot status correction',
        content: 'Plot A-01-001 is sold.',
        requestedScope: 'global',
        reason: 'Natural-language claim',
      },
      context({ role: 'admin', userId: 9 }),
    );

    expect(result.status).toBe('stored_for_validation');
  });

  it('stores recommendation feedback as a linked signal without a knowledge row or training side effect', async () => {
    const { client, service } = setup({
      source: 'I selected option B because option A was too far away.',
      signalId: 501,
      run: {
        recommendationRunId: 'REC-1',
        candidateOptionIds: ['OPT-001', 'OPT-002'],
        featureSnapshot: {
          'OPT-001': { zone_match: 1 },
          'OPT-002': { zone_match: 1 },
        },
        requirementSnapshot: { numberOfPlots: 1 },
        modelVersion: 'rule-based-v1',
      },
    });
    const result = await service.processProposal(
      {
        memoryType: 'recommendation_feedback',
        category: 'plot_ranking',
        title: 'Selected option B',
        content: 'Option B was selected because A was too far away.',
        requestedScope: 'user',
        reason: 'Pairwise recommendation preference',
        selectedOptionId: 'B',
        rejectedOptionId: 'A',
      },
      context(),
    );

    expect(result).toEqual({
      status: 'stored_as_learning_signal',
      message:
        'Recommendation feedback was recorded as an analysis signal; no model was retrained.',
      learningSignalId: 501,
    });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO ai_knowledge_entries'),
      ),
    ).toBe(false);
    const signalInsert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_learning_signals'),
    );
    expect(signalInsert?.[1]).toEqual(
      expect.arrayContaining([
        'REC-1',
        'OPT-002',
        'OPT-001',
        'rule-based-v1',
        true,
      ]),
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        /ai_training_(?:runs|samples)|\/train/i.test(String(sql)),
      ),
    ).toBe(false);
  });

  it('keeps incomplete recommendation context analytics-only', async () => {
    const { client, service } = setup({ source: 'I selected option B.' });
    await service.processProposal(
      {
        memoryType: 'recommendation_feedback',
        category: 'plot_ranking',
        title: 'Selected option B',
        content: 'I selected option B.',
        requestedScope: 'user',
        reason: 'Selection',
        selectedOptionId: 'B',
      },
      context(),
    );

    const signalInsert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO ai_learning_signals'),
    );
    expect(signalInsert?.[1]?.[10]).toBe(false);
  });

  it('returns a structured error and never relies on invalid ON CONFLICT targets', async () => {
    const failed = setup({ failTransaction: true });
    await expect(
      failed.service.processProposal(preference(), context()),
    ).resolves.toMatchObject({ status: 'error' });

    const successful = setup();
    await successful.service.processProposal(preference(), context());
    expect(
      successful.client.query.mock.calls.some(([sql]) =>
        String(sql).includes('ON CONFLICT'),
      ),
    ).toBe(false);
  });
});
