import { BadRequestException } from '@nestjs/common';
import {
  AGENT_PLANNER_TOOL_NAME,
  parseAgentPlan,
  recommendationDiscoveryQuestion,
} from './agent-planner';

describe('agent planner', () => {
  it('parses a structured recommendation plan', () => {
    expect(
      parseAgentPlan(
        JSON.stringify({
          intent: 'recommend_plots',
          action: 'rank_plot_options',
          needsClarification: false,
          clarificationQuestion: '',
          budgetMax: 300_000_000,
          numberOfPlots: 2,
          needAdjacent: true,
        }),
      ),
    ).toEqual({
      intent: 'recommend_plots',
      action: 'rank_plot_options',
      contextMode: 'replace',
      needsClarification: false,
      clarificationQuestion: '',
      requirements: {
        budgetMax: 300_000_000,
        numberOfPlots: 2,
        needAdjacent: true,
      },
    });
  });

  it('rejects actions outside the registered planner contract', () => {
    expect(() =>
      parseAgentPlan(
        JSON.stringify({
          intent: 'recommend_plots',
          action: 'recommend_plots',
          needsClarification: false,
          clarificationQuestion: '',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('uses the dedicated forced planner tool name', () => {
    expect(AGENT_PLANNER_TOOL_NAME).toBe('plan_cemetery_concierge_action');
  });

  it('drops model placeholders and normalizes a zone code', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'rank_plot_options',
        needsClarification: false,
        clarificationQuestion: '',
        budgetMin: 300_000_000,
        budgetMax: 300_000_000,
        numberOfPlots: 2,
        preferredZone: 'a',
        minAreaSqm: 0,
        maxAreaSqm: 0,
      }),
    );

    expect(plan.requirements).toEqual({
      budgetMax: 300_000_000,
      numberOfPlots: 2,
      preferredZone: 'Khu A',
    });
  });

  it('supports a relaxed browse request without carrying an old budget', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'browse_available_plots',
        contextMode: 'relax',
        needsClarification: false,
        clarificationQuestion: '',
        numberOfPlots: 1,
      }),
    );

    expect(plan).toEqual({
      intent: 'recommend_plots',
      action: 'browse_available_plots',
      contextMode: 'relax',
      needsClarification: false,
      clarificationQuestion: '',
      requirements: { numberOfPlots: 1 },
    });
  });

  it('parses an Agent-led service booking turn', () => {
    expect(
      parseAgentPlan(
        JSON.stringify({
          intent: 'service_booking',
          action: 'prepare_service_order',
          contextMode: 'continue',
          needsClarification: false,
          clarificationQuestion: '',
          serviceQuery: 'dọn dẹp mộ',
          selectedPlotCode: 'A-01-001',
          requestedDate: '2026-08-10',
        }),
      ),
    ).toEqual({
      intent: 'service_booking',
      action: 'prepare_service_order',
      contextMode: 'continue',
      needsClarification: false,
      clarificationQuestion: '',
      requirements: {
        serviceQuery: 'dọn dẹp mộ',
        selectedPlotCode: 'A-01-001',
        requestedDate: '2026-08-10',
      },
    });
  });

  it('asks for discovery before a vague plot introduction', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'browse_available_plots',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        numberOfPlots: 1,
      }),
    );

    expect(recommendationDiscoveryQuestion(plan, 'giới thiệu đi bé')).toContain(
      'ngân sách',
    );
  });

  it('allows immediate browsing when the customer explicitly delegates', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'browse_available_plots',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        numberOfPlots: 1,
      }),
    );

    expect(
      recommendationDiscoveryQuestion(
        plan,
        'chọn đại một lô, không cần hỏi thêm',
      ),
    ).toBe('');
  });

  it('asks a family-specific discovery question for clan plots', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'rank_plot_options',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        budgetMax: 500_000_000,
        plotType: 'family',
        needAdjacent: true,
      }),
    );

    expect(recommendationDiscoveryQuestion(plan, 'tìm lô dòng tộc')).toContain(
      'lô family chuyên dụng',
    );
  });
});
