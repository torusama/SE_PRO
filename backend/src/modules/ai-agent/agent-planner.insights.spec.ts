import { parseAgentPlan } from './agent-planner';

describe('agent planner insight actions', () => {
  it('parses a plot competitiveness action with the resolved plot code', () => {
    expect(
      parseAgentPlan(
        JSON.stringify({
          intent: 'plot_competitiveness',
          action: 'analyze_plot_competitiveness',
          contextMode: 'continue',
          needsClarification: false,
          clarificationQuestion: '',
          selectedPlotCode: 'A-01-001',
        }),
      ),
    ).toMatchObject({
      intent: 'plot_competitiveness',
      action: 'analyze_plot_competitiveness',
      requirements: { selectedPlotCode: 'A-01-001' },
    });
  });

  it('parses customer care without accepting an identity field', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'customer_care',
        action: 'get_customer_care_overview',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        userId: 999,
      }),
    );

    expect(plan).toMatchObject({
      intent: 'customer_care',
      action: 'get_customer_care_overview',
      requirements: {},
    });
    expect(plan.requirements).not.toHaveProperty('userId');
  });
});
