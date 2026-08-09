import { BadRequestException } from '@nestjs/common';
import { AgentToolRegistryService } from './agent-tool-registry.service';

describe('AgentToolRegistryService', () => {
  const registry = new AgentToolRegistryService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('rejects malformed JSON tool arguments', () => {
    expect(() => registry.parseArguments('{bad json')).toThrow(
      BadRequestException,
    );
  });

  it('rejects tools outside the allowlist', async () => {
    await expect(registry.execute('drop_database', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('passes only trusted execution context to autonomous learning', async () => {
    const autoLearning = {
      processProposal: jest.fn().mockResolvedValue({
        status: 'saved_user_memory',
        message: 'saved',
      }),
    };
    const learningRegistry = new AgentToolRegistryService(
      {} as never,
      {} as never,
      {} as never,
      autoLearning as never,
      {} as never,
    );

    await learningRegistry.execute(
      'propose_knowledge_update',
      {
        category: 'plot_location',
        title: 'Near entrance',
        content: 'I prefer plots near the entrance.',
        memoryType: 'user_preference',
        requestedScope: 'global',
        memoryKey: 'preferred_plot_location',
        reason: 'Explicit preference',
      },
      {
        userId: 9,
        role: 'admin',
        conversationId: 10,
        sourceMessageId: 11,
        sessionId: 'SES-1',
      },
    );

    expect(autoLearning.processProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryType: 'user_preference',
        memoryKey: 'preferred_plot_location',
      }),
      {
        userId: 9,
        role: 'admin',
        conversationId: 10,
        sourceMessageId: 11,
        sessionId: 'SES-1',
      },
    );
  });

  it.each([
    'userId',
    'role',
    'conversationId',
    'sourceMessageId',
    'validationStatus',
    'confidenceScore',
    'modelVersion',
  ])('rejects LLM-controlled trusted field %s', async (field) => {
    await expect(
      registry.execute('propose_knowledge_update', {
        category: 'plot_location',
        title: 'Near entrance',
        content: 'I prefer plots near the entrance.',
        memoryType: 'user_preference',
        requestedScope: 'user',
        reason: 'Explicit preference',
        [field]: 'untrusted',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid enums and literal null/undefined strings', async () => {
    await expect(
      registry.execute('propose_knowledge_update', {
        category: 'undefined',
        title: 'Title',
        content: 'Content',
        memoryType: 'implicit_profile',
        requestedScope: 'public',
        reason: 'Reason',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('routes plot competitiveness through a validated plot code', async () => {
    const insights = {
      analyzePlotCompetitiveness: jest.fn().mockResolvedValue({ found: true }),
    };
    const insightRegistry = new AgentToolRegistryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      insights as never,
    );

    await insightRegistry.execute('analyze_plot_competitiveness', {
      plotCode: ' A-01-001 ',
    });

    expect(insights.analyzePlotCompetitiveness).toHaveBeenCalledWith(
      'A-01-001',
    );
  });

  it('preserves cumulative plot exclusions for both recommendation tools', async () => {
    const recommendations = {
      recommend: jest.fn().mockResolvedValue({ recommendations: [] }),
      browseAvailablePlots: jest
        .fn()
        .mockResolvedValue({ recommendations: [] }),
    };
    const recommendationRegistry = new AgentToolRegistryService(
      recommendations as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await recommendationRegistry.execute('rank_plot_options', {
      budgetMax: 100_000_000,
      numberOfPlots: 1,
      recommendationCount: 2,
      comparisonRequested: true,
      excludePlotIds: [34, 33, 34],
    });
    await recommendationRegistry.execute('browse_available_plots', {
      numberOfPlots: 1,
      recommendationCount: 2,
      comparisonRequested: true,
      excludePlotIds: [34, 33, 34],
    });

    expect(recommendations.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendationCount: 2,
        comparisonRequested: true,
        excludePlotIds: [34, 33],
      }),
      expect.any(Object),
    );
    expect(recommendations.browseAvailablePlots).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendationCount: 2,
        comparisonRequested: true,
        excludePlotIds: [34, 33],
      }),
      expect.any(Object),
    );
  });

  it('uses only the trusted authenticated user for customer care', async () => {
    const insights = {
      getCustomerCareOverview: jest.fn().mockResolvedValue({
        loginRequired: false,
      }),
    };
    const insightRegistry = new AgentToolRegistryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      insights as never,
    );

    await insightRegistry.execute(
      'get_customer_care_overview',
      {},
      { userId: 42 },
    );

    expect(insights.getCustomerCareOverview).toHaveBeenCalledWith(42);
    await expect(
      insightRegistry.execute(
        'get_customer_care_overview',
        { userId: 99 },
        { userId: 42 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
