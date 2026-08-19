import { DatabaseService } from '../../database/database.service';
import { LearningAnalyticsService } from './learning-analytics.service';

function setup(withData = true) {
  const database = {
    queryOne: jest.fn((sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM ai_knowledge_entries')) {
        return withData
          ? {
              activeUserMemories: '12',
              usersWithMemory: 5,
              activeGlobalKnowledge: 8,
              quarantinedKnowledge: 3,
              pendingCustomerProposals: 4,
            }
          : null;
      }
      if (sql.includes('FROM ai_llm_calls')) {
        return withData
          ? {
              totalCalls: 40,
              successfulCalls: 36,
              failedCalls: 4,
              fallbackResponses: 3,
              promptTokens: 12000,
              completionTokens: 6000,
              totalTokens: 18000,
              averageLatencyMs: 820,
              p95LatencyMs: 1400,
              estimatedCostUsd: 0.0325,
              unpricedCalls: 2,
              unmeteredCalls: 1,
            }
          : null;
      }
      return withData
        ? {
            memoryUpdates: 7,
            globalKnowledgeUpdates: 4,
            recommendationSignals: 6,
            trainingReadySignals: 2,
            recommendationRuns: 20,
            rankerEnabledRuns: 10,
            mlRankedRuns: 12,
            fallbackRuns: 5,
            rankedRecommendationRuns: 20,
          }
        : null;
    }),
    query: jest.fn((sql: string, _params?: unknown[]) => {
      if (!withData) return [];
      if (sql.includes('GROUP BY validation_status')) {
        return [
          { key: 'active', count: '20' },
          { key: 'quarantined', count: 3 },
        ];
      }
      if (sql.includes('GROUP BY memory_key')) {
        return [
          { key: 'preferred_plot_location', count: 8 },
          { key: 'maximum_budget', count: 4 },
        ];
      }
      if (sql.includes('GROUP BY training_ready')) {
        return [
          { key: 'training_ready', count: 2 },
          { key: 'analytics_only', count: 4 },
        ];
      }
      if (sql.includes('GROUP BY fallback_reason')) {
        return [{ key: 'disabled', count: 5 }];
      }
      if (sql.includes('GROUP BY provider_id, provider_name, model')) {
        return [
          {
            key: 'test-model',
            providerId: 'openai-primary',
            calls: 40,
            failedCalls: 4,
            totalTokens: 18000,
            averageLatencyMs: 820,
            estimatedCostUsd: 0.0325,
          },
        ];
      }
      if (sql.includes('runtime_events AS')) {
        return [
          {
            date: '2026-07-28',
            calls: 18,
            failedCalls: 1,
            totalTokens: 8000,
            averageLatencyMs: 760,
            estimatedCostUsd: 0.014,
          },
          {
            date: '2026-07-29',
            calls: 22,
            failedCalls: 3,
            totalTokens: 10000,
            averageLatencyMs: 870,
            estimatedCostUsd: 0.0185,
          },
        ];
      }
      if (sql.includes('WITH reporting_days')) {
        return [
          {
            date: '2026-07-28',
            memoryUpdates: 2,
            knowledgeUpdates: 1,
            signals: 3,
            recommendations: 4,
            aiAccesses: 6,
          },
          {
            date: '2026-07-29',
            memoryUpdates: 5,
            knowledgeUpdates: 3,
            signals: 3,
            recommendations: 16,
            aiAccesses: 9,
          },
        ];
      }
      if (sql.includes('LIMIT 12')) {
        return [
          {
            versionId: '91',
            actionType: 'activated',
            actorRole: 'admin',
            validationReason: 'Verified admin update.',
            createdAt: '2026-07-29T08:00:00.000Z',
            knowledgeType: 'faq',
            scope: 'global',
            memoryKey: 'faq:purchase_process',
            title: 'Purchase process',
            validationStatus: 'active',
          },
        ];
      }
      if (sql.includes('WITH learning_journal')) {
        return [
          {
            eventId: 'knowledge-91',
            eventType: 'global_knowledge',
            actionType: 'activated',
            subject: 'Purchase process',
            status: 'active',
            source: 'admin',
            detail: 'Verified admin update.',
            modelVersion: null,
            createdAt: '2026-07-29T08:00:00.000Z',
          },
          {
            eventId: 'signal-17',
            eventType: 'recommendation_signal',
            actionType: 'signal_recorded',
            subject: 'recommendation_feedback',
            status: 'training_ready',
            source: 'system',
            detail: 'Complete recommendation context.',
            modelVersion: 'plot-ranker-v2',
            createdAt: '2026-07-29T07:00:00.000Z',
          },
        ];
      }
      throw new Error(`Unexpected analytics SQL: ${sql.slice(0, 80)}`);
    }),
  };
  return {
    database,
    service: new LearningAnalyticsService(
      database as unknown as DatabaseService,
    ),
  };
}

describe('LearningAnalyticsService', () => {
  it('returns seminar-ready aggregates and clamps the reporting window', async () => {
    const { database, service } = setup();

    const result = await service.dashboard('3');

    expect(result.period.days).toBe(7);
    expect(result.currentState).toEqual({
      activeUserMemories: 12,
      usersWithMemory: 5,
      activeGlobalKnowledge: 8,
      quarantinedKnowledge: 3,
      pendingCustomerProposals: 4,
    });
    expect(result.periodActivity).toMatchObject({
      memoryUpdates: 7,
      recommendationSignals: 6,
      mlRankedRuns: 12,
      fallbackRuns: 5,
      fallbackRate: 25,
    });
    expect(result.runtime).toMatchObject({
      totalCalls: 40,
      failedCalls: 4,
      fallbackResponses: 3,
      failureRate: 10,
      totalTokens: 18000,
      averageLatencyMs: 820,
      p95LatencyMs: 1400,
      estimatedCostUsd: 0.0325,
    });
    expect(result.runtimeByModel[0]).toMatchObject({
      key: 'test-model',
      providerId: 'openai-primary',
      calls: 40,
    });
    expect(result.runtimeTimeline).toHaveLength(2);
    expect(result.memoryByKey[0]).toEqual({
      key: 'preferred_plot_location',
      count: 8,
    });
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline.map((item) => item.aiAccesses)).toEqual([6, 9]);
    const timelineQuery = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('WITH reporting_days'),
    )?.[0];
    expect(timelineQuery).toContain('FROM ai_messages');
    expect(timelineQuery).toContain("role = 'user'");
    expect(result.recentUpdates[0]).toMatchObject({
      versionId: 91,
      actionType: 'activated',
      actorRole: 'admin',
      knowledgeType: 'faq',
      scope: 'global',
    });
    expect(result.recentEvents).toEqual([
      expect.objectContaining({
        eventId: 'knowledge-91',
        eventType: 'global_knowledge',
        actionType: 'activated',
        source: 'admin',
      }),
      expect.objectContaining({
        eventId: 'signal-17',
        eventType: 'recommendation_signal',
        status: 'training_ready',
      }),
    ]);

    const parameterizedCalls = [
      ...database.queryOne.mock.calls,
      ...database.query.mock.calls,
    ].filter(([, params]) => Array.isArray(params) && params.length > 0);
    expect(parameterizedCalls.every(([, params]) => params?.[0] === 7)).toBe(
      true,
    );
    const recentQuery = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('LIMIT 12'),
    )?.[0];
    expect(recentQuery).not.toContain('e.content');
    expect(recentQuery).not.toContain('owner_user_id');
    const journalQuery = database.query.mock.calls.find(([sql]) =>
      String(sql).includes('WITH learning_journal'),
    )?.[0];
    expect(journalQuery).not.toContain('s.explanation');
    expect(journalQuery).not.toContain('user_id');
    expect(journalQuery).not.toContain('conversation_id');
    expect(journalQuery).not.toContain('source_message_id');
  });

  it('returns stable zero and empty states when there is no learning data', async () => {
    const { service } = setup(false);

    const result = await service.dashboard('invalid');

    expect(result.period.days).toBe(30);
    expect(result.currentState.activeUserMemories).toBe(0);
    expect(result.periodActivity.recommendationRuns).toBe(0);
    expect(result.runtime.totalCalls).toBe(0);
    expect(result.runtime.totalTokens).toBe(0);
    expect(result.runtime.fallbackResponses).toBe(0);
    expect(result.runtimeByModel).toEqual([]);
    expect(result.runtimeTimeline).toEqual([]);
    expect(result.periodActivity.fallbackRate).toBe(0);
    expect(result.knowledgeByStatus).toEqual([]);
    expect(result.timeline).toEqual([]);
    expect(result.recentUpdates).toEqual([]);
    expect(result.recentEvents).toEqual([]);
  });
});
