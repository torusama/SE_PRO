import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { AGENT_PLANNER_TOOL_NAME, AgentPlan } from './agent-planner';
import { AgentBookingService } from './agent-booking.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AiAgentOrchestratorService } from './ai-agent-orchestrator.service';
import { KnowledgeService } from './knowledge.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';
import { PlotRecommendationService } from './plot-recommendation.service';
import { RecommendationResult } from './types/agent-response.types';

const recommendation: RecommendationResult = {
  requirements: {
    budgetMax: 400_000_000,
    numberOfPlots: 2,
    needAdjacent: true,
    preferNearEntrance: true,
  },
  recommendations: [
    {
      optionId: 'OPT-001',
      plotIds: [1, 2],
      plotCodes: ['A-01-001', 'A-01-002'],
      plots: [],
      score: 0.9,
      plotCost: 300_000_000,
      serviceCost: 0,
      estimatedTotal: 300_000_000,
      currency: 'VND',
      zoneName: 'Khu A',
      directions: ['East'],
      totalAreaSqm: 40,
      isAdjacent: true,
      reasons: ['Near entrance'],
      tradeOffs: [],
      highlightPlotIds: [1, 2],
      accessSummary: 'Near the main entrance',
      entranceDistanceMapUnits: 100,
    },
  ],
  suggestedServices: [],
  rankerVersion: 'rule-based-v1',
  fallbackUsed: true,
  rankerFallbackReason: 'disabled',
  recommendationRunId: 'REC-1',
};

function plannerPlan(): AgentPlan {
  return {
    intent: 'recommend_plots',
    action: 'rank_plot_options',
    contextMode: 'replace',
    needsClarification: false,
    clarificationQuestion: '',
    requirements: {
      budgetMax: 400_000_000,
      numberOfPlots: 2,
      needAdjacent: true,
      preferNearEntrance: true,
    },
    memoryProposals: [
      {
        category: 'plot_location',
        title: 'Near entrance',
        content: 'I prefer plots near the entrance.',
        memoryType: 'user_preference',
        requestedScope: 'user',
        memoryKey: 'preferred_plot_location',
        reason: 'Explicit preference',
      },
    ],
  };
}

function setup(memoryFailure = false) {
  let messageId = 100;
  const database = {
    queryOne: jest.fn((sql: string) => {
      if (sql.includes('INSERT INTO ai_conversations')) {
        return { id: 10, sessionId: 'SES-1', userId: 7 };
      }
      if (sql.includes('INSERT INTO ai_messages')) {
        messageId += 1;
        return { id: messageId };
      }
      return null;
    }),
    query: jest.fn(() => []),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ai.maxHistoryMessages') return 20;
      if (key === 'ai.fallbackRuleBased') return true;
      return undefined;
    }),
  };
  const plan = plannerPlan();
  const nvidia = {
    model: 'frozen-foundation-model',
    isConfigured: jest.fn(() => true),
    chat: jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: AGENT_PLANNER_TOOL_NAME,
                    arguments: JSON.stringify({
                      intent: plan.intent,
                      action: plan.action,
                      contextMode: plan.contextMode,
                      needsClarification: false,
                      clarificationQuestion: '',
                      budgetMax: plan.requirements.budgetMax,
                      numberOfPlots: plan.requirements.numberOfPlots,
                      needAdjacent: true,
                      preferNearEntrance: true,
                      memoryProposals: plan.memoryProposals,
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                'A-01-001 and A-01-002 are adjacent and total 300,000,000 VND.',
            },
          },
        ],
      }),
  };
  const tools = {
    isAllowed: jest.fn(() => true),
    execute: jest.fn((name: string) => {
      if (name === 'propose_knowledge_update') {
        if (memoryFailure) throw new Error('memory unavailable');
        return {
          status: 'saved_user_memory',
          message: 'saved',
          knowledgeEntryId: 55,
        };
      }
      return recommendation;
    }),
  };
  const knowledge = {
    getUserPromptContext: jest.fn(() =>
      [
        '<PERSISTENT_USER_PREFERENCES>',
        '- [preferred_plot_location] Near entrance',
        '</PERSISTENT_USER_PREFERENCES>',
        '<VERIFIED_GLOBAL_KNOWLEDGE>',
        '- [faq] Verified process',
        '</VERIFIED_GLOBAL_KNOWLEDGE>',
      ].join('\n'),
    ),
    getCurrentVersion: jest.fn(() => 'kb-test'),
  };
  const booking = {
    loadPendingAction: jest.fn(() => null),
    handleTurn: jest.fn(() => null),
  };
  const service = new AiAgentOrchestratorService(
    database as unknown as DatabaseService,
    config as unknown as ConfigService,
    nvidia as unknown as MultiProviderLlmService,
    tools as unknown as AgentToolRegistryService,
    {} as PlotRecommendationService,
    knowledge as unknown as KnowledgeService,
    booking as unknown as AgentBookingService,
  );
  return { service, tools, nvidia, knowledge };
}

describe('AiAgentOrchestratorService application-level learning', () => {
  it('saves memory and still executes the primary recommendation with the trusted role', async () => {
    const { service, tools, nvidia, knowledge } = setup();

    const result = await service.chat(
      {
        sessionId: 'SES-1',
        message:
          'Remember that I prefer plots near the entrance and recommend two adjacent plots under 400,000,000 VND.',
      },
      { id: 7, role: 'admin' },
    );

    expect(knowledge.getUserPromptContext).toHaveBeenCalledWith(7);
    expect(tools.execute).toHaveBeenNthCalledWith(
      1,
      'propose_knowledge_update',
      expect.objectContaining({ memoryType: 'user_preference' }),
      expect.objectContaining({
        userId: 7,
        role: 'admin',
        conversationId: 10,
        sourceMessageId: 101,
      }),
    );
    expect(tools.execute).toHaveBeenNthCalledWith(
      2,
      'rank_plot_options',
      expect.objectContaining({
        budgetMax: 400_000_000,
        numberOfPlots: 2,
      }),
      expect.objectContaining({ userId: 7, role: 'admin' }),
    );
    expect(result.recommendations).toHaveLength(1);
    expect(result.assistantMessage).toContain('Mình đã lưu sở thích');
    const plannerSystemPrompt = nvidia.chat.mock.calls[0][0][0].content;
    const composerSystemPrompt = nvidia.chat.mock.calls[1][0][0].content;
    expect(plannerSystemPrompt).toContain('<PERSISTENT_USER_PREFERENCES>');
    expect(composerSystemPrompt).toContain('<VERIFIED_GLOBAL_KNOWLEDGE>');
  });

  it('continues the primary action and does not claim storage when memory persistence fails', async () => {
    const { service, tools } = setup(true);

    const result = await service.chat(
      {
        sessionId: 'SES-1',
        message:
          'Remember that I prefer plots near the entrance and recommend two adjacent plots under 400,000,000 VND.',
      },
      { id: 7, role: 'customer' },
    );

    expect(tools.execute).toHaveBeenCalledWith(
      'rank_plot_options',
      expect.any(Object),
      expect.objectContaining({ role: 'customer' }),
    );
    expect(result.recommendations).toHaveLength(1);
    expect(result.assistantMessage).toContain('chưa thể lưu');
    expect(result.assistantMessage).not.toContain('Mình đã lưu sở thích');
    expect(result.metadata.learningResults).toEqual([
      expect.objectContaining({ status: 'error' }),
    ]);
  });
});
