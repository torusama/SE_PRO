import { AiAgentOrchestratorService } from './ai-agent-orchestrator.service';

describe('AiAgentOrchestrator consultation continuity', () => {
  const createService = () =>
    new AiAgentOrchestratorService(
      {} as never,
      { get: jest.fn() } as never,
      { model: 'test', isConfigured: () => true } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getActiveUserPreferences: jest.fn().mockResolvedValue([
          {
            memoryKey: 'maximum_budget',
            content: 'Ngân sách tối đa 200 triệu',
          },
        ]),
      } as never,
      {} as never,
      {} as never,
    );

  it('defaults a normal plot-discovery request to one plot per alternative', () => {
    const service = createService() as any;
    expect(
      service.applyNaturalRecommendationDefaults('lô baby', 'recommend_plots', {
        budgetMax: 200_000_000,
      }),
    ).toMatchObject({ budgetMax: 200_000_000, numberOfPlots: 1 });
  });

  it('treats “gợi ý 3 lô” as three alternatives, not one three-plot purchase', () => {
    const service = createService() as any;
    expect(
      service.applyNaturalRecommendationDefaults(
        'Gợi ý cho mình 3 lô dưới 35 triệu',
        'recommend_plots',
        { budgetMax: 35_000_000, numberOfPlots: 3 },
      ),
    ).toMatchObject({
      budgetMax: 35_000_000,
      numberOfPlots: 1,
      needAdjacent: false,
    });
  });

  it('treats “so sánh 2 lô” as two alternatives, not a two-plot purchase', () => {
    const service = createService() as any;
    expect(
      service.applyNaturalRecommendationDefaults(
        'So sánh 2 lô phù hợp ngân sách 300 triệu',
        'recommend_plots',
        {
          budgetMax: 300_000_000,
          numberOfPlots: 2,
          recommendationCount: 2,
          comparisonRequested: true,
        },
      ),
    ).toMatchObject({
      numberOfPlots: 1,
      recommendationCount: 2,
      comparisonRequested: true,
      needAdjacent: false,
    });
  });

  it('keeps an explicit request to acquire three adjacent plots as a group', () => {
    const service = createService() as any;
    expect(
      service.applyNaturalRecommendationDefaults(
        'Mình cần mua 3 lô liền nhau',
        'recommend_plots',
        { numberOfPlots: 3, needAdjacent: true },
      ),
    ).toMatchObject({ numberOfPlots: 3, needAdjacent: true });
  });

  it('continues plot consultation for a colloquial follow-up', () => {
    const service = createService() as any;
    const result = service.contextualizeClarificationReply(
      'oki z gợi ý dùm i',
      [
        { id: 1, role: 'user', content: 'lô baby' },
        {
          id: 2,
          role: 'assistant',
          content: 'Mình có thể tìm lô theo dữ liệu đang có.',
        },
      ],
      { budgetMax: 200_000_000 },
      'general_question',
    );
    expect(result.intent).toBe('recommend_plots');
    expect(result.requirements).toMatchObject({
      budgetMax: 200_000_000,
      numberOfPlots: 1,
    });
  });

  it('builds a local ranked-search plan when saved budget is already known', () => {
    const service = createService() as any;
    const plan = service.buildDeterministicPlotConsultationPlan(
      'oki z gợi ý dùm i',
      'recommend_plots',
      { budgetMax: 200_000_000, numberOfPlots: 1 },
      [
        {
          id: 1,
          role: 'assistant',
          content:
            'Mình đang tư vấn lô và phương án phù hợp ngân sách của bạn.',
        },
      ],
    );
    expect(plan).toMatchObject({
      intent: 'recommend_plots',
      action: 'rank_plot_options',
      needsClarification: false,
      requirements: { budgetMax: 200_000_000, numberOfPlots: 1 },
    });
  });

  it('does not let a weak planner collapse a plot request into memory chatter', () => {
    const service = createService() as any;
    const plan = service.reconcilePlannerWithTrustedContext(
      {
        intent: 'general_question',
        action: 'none',
        contextMode: 'continue',
        needsClarification: false,
        clarificationQuestion: '',
        directResponse: 'Mình vẫn nhớ các ưu tiên của bạn.',
        requirements: { budgetMax: 200_000_000 },
      },
      'gợi ý vài lô cho tui',
      'recommend_plots',
    );
    expect(plan.action).toBe('rank_plot_options');
    expect(plan.requirements.numberOfPlots).toBe(1);
    expect(plan.directResponse).toBe('');
  });

  it('does not dump saved-memory summaries as a generic outage fallback', async () => {
    const service = createService() as any;
    const answer = await service.buildGracefulConversationFallback(
      'oki z gợi ý dùm i',
      10,
    );
    expect(answer).not.toContain('ưu tiên chính');
    expect(answer).not.toContain('ngân sách tối đa của bạn');
  });
});
