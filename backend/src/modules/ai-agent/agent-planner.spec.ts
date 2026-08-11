import { BadRequestException } from '@nestjs/common';
import {
  AGENT_PLANNER_TOOL,
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
          recommendationCount: 2,
          comparisonRequested: true,
          needAdjacent: true,
          preferNearEntrance: true,
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
        recommendationCount: 2,
        comparisonRequested: true,
        needAdjacent: true,
        preferNearEntrance: true,
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

  it('keeps a memory proposal additive to the primary recommendation action', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'recommend_plots',
        action: 'rank_plot_options',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        budgetMax: 400_000_000,
        numberOfPlots: 2,
        needAdjacent: true,
        memoryProposals: [
          {
            category: 'plot_location',
            title: 'Near entrance',
            content: 'I prefer plots near the entrance.',
            memoryType: 'user_preference',
            requestedScope: 'user',
            memoryKey: 'preferred_plot_location',
            reason: 'Explicit reusable preference',
          },
        ],
      }),
    );

    expect(plan.action).toBe('rank_plot_options');
    expect(plan.requirements).toMatchObject({
      budgetMax: 400_000_000,
      numberOfPlots: 2,
      needAdjacent: true,
    });
    expect(plan.memoryProposals).toEqual([
      expect.objectContaining({
        memoryType: 'user_preference',
        requestedScope: 'user',
        memoryKey: 'preferred_plot_location',
      }),
    ]);
  });

  it('drops malformed memory proposals without blocking the primary action', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'service_suggestions',
        action: 'get_service_suggestions',
        contextMode: 'replace',
        needsClarification: false,
        clarificationQuestion: '',
        memoryProposals: [
          {
            category: 'undefined',
            title: '',
            content: 'null',
            memoryType: 'implicit_profile',
            requestedScope: 'global',
            reason: 'invalid',
          },
        ],
      }),
    );

    expect(plan.action).toBe('get_service_suggestions');
    expect(plan.memoryProposals).toBeUndefined();
  });

  it('exposes only the canonical memory proposal field names and enums', () => {
    const schema = JSON.stringify(AGENT_PLANNER_TOOL);
    expect(schema).toContain('memoryProposals');
    expect(schema).toContain('memoryType');
    expect(schema).toContain('user_preference');
    expect(schema).not.toContain('knowledgeProposals');
    expect(schema).not.toContain('implicit_profile');
    expect(schema).not.toContain('explicit_preference');
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

  it('parses a plot-viewing appointment as an operational action', () => {
    expect(
      parseAgentPlan(
        JSON.stringify({
          intent: 'appointment_booking',
          action: 'prepare_appointment',
          contextMode: 'replace',
          needsClarification: false,
          clarificationQuestion: '',
          directResponse: '',
          appointmentDate: '2026-08-20',
          appointmentStartTime: '09:00',
          appointmentEndTime: '10:00',
          appointmentTopic: 'Tham quan lô A-01-001',
          selectedPlotCode: 'A-01-001',
        }),
      ),
    ).toMatchObject({
      intent: 'appointment_booking',
      action: 'prepare_appointment',
      requirements: {
        appointmentDate: '2026-08-20',
        appointmentStartTime: '09:00',
        appointmentEndTime: '10:00',
        appointmentTopic: 'Tham quan lô A-01-001',
        selectedPlotCode: 'A-01-001',
      },
    });
  });

  it('parses a memorial reminder draft without losing email recipients', () => {
    expect(
      parseAgentPlan(
        JSON.stringify({
          intent: 'memorial_reminder',
          action: 'prepare_memorial_reminder',
          contextMode: 'replace',
          needsClarification: false,
          clarificationQuestion: '',
          directResponse: '',
          reminderTitle: 'Tưởng niệm người thân',
          reminderDescription: 'Lời nhắc trang trọng cho gia đình.',
          reminderDate: '2026-08-20',
          reminderRecurring: true,
          reminderCalendarType: 'lunar',
          reminderNotifyDaysBefore: 5,
          reminderNotifyEmails: [' Family@Example.com ', 'member@example.com'],
        }),
      ),
    ).toMatchObject({
      intent: 'memorial_reminder',
      action: 'prepare_memorial_reminder',
      requirements: {
        reminderDate: '2026-08-20',
        reminderRecurring: true,
        reminderCalendarType: 'lunar',
        reminderNotifyDaysBefore: 5,
        reminderNotifyEmails: ['family@example.com', 'member@example.com'],
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
  it('parses a one-call conversational response and consultation-topic memory', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'general_question',
        action: 'none',
        contextMode: 'continue',
        needsClarification: false,
        clarificationQuestion: '',
        directResponse:
          'Mình hiểu. Khi phù hợp mình sẽ ưu tiên giải thích theo góc nhìn phong thủy.',
        memoryProposals: [
          {
            category: 'conversation_preference',
            title: 'Ưu tiên chủ đề phong thủy',
            content:
              'Người dùng muốn các cuộc trao đổi phù hợp ưu tiên góc nhìn phong thủy.',
            memoryType: 'user_preference',
            requestedScope: 'user',
            memoryKey: 'consultation_topic_preference',
            reason: 'Explicit reusable conversation preference',
          },
        ],
      }),
    );

    expect(plan.action).toBe('none');
    expect(plan.directResponse).toContain('phong thủy');
    expect(plan.memoryProposals?.[0]).toMatchObject({
      memoryType: 'user_preference',
      requestedScope: 'user',
      memoryKey: 'consultation_topic_preference',
    });
  });

  it('does not preserve a legacy hold choice from planner output', () => {
    const plan = parseAgentPlan(
      JSON.stringify({
        intent: 'plot_request',
        action: 'prepare_plot_request',
        contextMode: 'continue',
        needsClarification: false,
        clarificationQuestion: '',
        requestType: 'reserve',
        selectedPlotCode: 'A-01-001',
      }),
    );

    expect(plan.requirements).toEqual({
      selectedPlotCode: 'A-01-001',
    });
  });
});
