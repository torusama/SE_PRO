import { AgentPlan } from './agent-planner';
import {
  AiAgentOrchestratorService,
  extractDeterministicRequirements,
  extractPendingServiceRequestedDate,
  extractRequestedRecommendationCount,
  resolvePendingBookingReply,
} from './ai-agent-orchestrator.service';
import { AgentPendingAction } from './types/agent-response.types';

describe('pending service date resolution', () => {
  const now = new Date('2026-08-10T02:52:00.000Z'); // 09:52 in Viet Nam

  it.each([
    ['Mình muốn thực hiện dịch vụ vào ngày mai.', '2026-08-11'],
    ['ngày kia', '2026-08-12'],
    ['sau 3 ngày nữa', '2026-08-13'],
    ['15/08/2026', '2026-08-15'],
    ['2026-08-20', '2026-08-20'],
  ])('resolves %s to %s', (message, expected) => {
    expect(extractPendingServiceRequestedDate(message, now)).toBe(expected);
  });

  it('does not mistake the service name mai táng for tomorrow', () => {
    expect(
      extractPendingServiceRequestedDate('Mình muốn dùng dịch vụ mai táng.', now),
    ).toBeUndefined();
  });

  it('forces a date reply back into the active service booking workflow', () => {
    const pending: AgentPendingAction = {
      kind: 'service_order',
      stage: 'collecting',
      serviceTypeId: 4,
      serviceName: 'Thắp hương',
      plotId: 12,
      plotCode: 'A-01-002',
      quotedPrice: 200_000,
      serviceUnit: 'lần',
    };
    const plan: AgentPlan = {
      intent: 'general_question',
      action: 'none',
      contextMode: 'continue',
      needsClarification: false,
      clarificationQuestion: '',
      requirements: {},
    };
    const result = resolvePendingBookingReply(
      plan,
      pending,
      'Mình muốn thực hiện dịch vụ vào ngày mai.',
    );

    expect(result).toMatchObject({
      intent: 'service_booking',
      action: 'prepare_service_order',
      contextMode: 'continue',
      requirements: { requestedDate: expect.any(String) },
      memoryProposals: [],
    });
  });
});

describe('AI Agent deterministic requirement extraction', () => {
  it.each([
    'tôi cần lô dòng tộc',
    'tìm khu mộ họ giúp mình',
    'gia tộc tôi cần một khu riêng',
  ])('maps "%s" to a family plot requirement', (message) => {
    expect(extractDeterministicRequirements(message)).toMatchObject({
      plotType: 'family',
      needAdjacent: true,
    });
  });

  it('keeps explicit family count, budget, zone and direction', () => {
    expect(
      extractDeterministicRequirements(
        'Tìm 3 lô dòng tộc liền kề ở khu B hướng Đông, ngân sách 600 triệu',
      ),
    ).toMatchObject({
      budgetMax: 600_000_000,
      numberOfPlots: 3,
      preferredZone: 'Khu B',
      preferredDirection: 'Đông',
      plotType: 'family',
      needAdjacent: true,
    });
  });

  it('recognizes entrance access as a ranking preference', () => {
    expect(
      extractDeterministicRequirements(
        'Mình vẫn giữ ngân sách cũ nhưng ưu tiên lô gần cổng hơn',
      ),
    ).toMatchObject({
      preferNearEntrance: true,
    });
  });

  it.each([
    ['So sánh 2 phương án đất nghĩa trang phù hợp ngân sách 300 triệu', 2],
    ['Gợi ý cho mình ba lô đang trống', 3],
    ['Cho xem 4 lựa chọn ở khu A', 4],
  ])('extracts the requested alternative count from "%s"', (message, count) => {
    expect(extractRequestedRecommendationCount(message)).toBe(count);
  });

  it('keeps comparison count separate from acquisition quantity', () => {
    expect(
      extractDeterministicRequirements(
        'So sánh 2 phương án đất nghĩa trang phù hợp ngân sách 300 triệu',
      ),
    ).toMatchObject({
      budgetMax: 300_000_000,
      recommendationCount: 2,
      comparisonRequested: true,
    });
    expect(
      extractRequestedRecommendationCount('Mình cần mua 2 lô liền kề'),
    ).toBeUndefined();
  });

  it('extracts appointment data without mistaking the date for a birth profile', () => {
    expect(
      extractDeterministicRequirements(
        'Đặt lịch gặp ban quản lý để xem lô A-01-001 ngày 20/08/2026 lúc 09:00.',
      ),
    ).toMatchObject({
      selectedPlotCode: 'A-01-001',
      appointmentDate: '2026-08-20',
      appointmentStartTime: '09:00',
      appointmentTopic: 'Tham quan và tư vấn lô A-01-001',
      birthDate: undefined,
    });
  });

  it('extracts the complete appointment range and panel-provided topic', () => {
    expect(
      extractDeterministicRequirements(
        'Mình muốn đặt lịch với ban quản lý vào ngày 2026-08-22, từ 14:30 đến 15:45. Nội dung: Trao đổi hợp đồng lô B-02-004.',
      ),
    ).toMatchObject({
      selectedPlotCode: 'B-02-004',
      appointmentDate: '2026-08-22',
      appointmentStartTime: '14:30',
      appointmentEndTime: '15:45',
      appointmentTopic: 'Trao đổi hợp đồng lô B-02-004',
      birthDate: undefined,
    });
  });

  it('extracts a memorial subject, recurrence and recipients for safe fallback', () => {
    expect(
      extractDeterministicRequirements(
        'Tạo lịch nhắc tưởng niệm ông nội ngày 20/08/2026 hằng năm gửi email Family@Example.com.',
      ),
    ).toMatchObject({
      reminderTitle: 'Tưởng niệm ông nội',
      reminderDate: '2026-08-20',
      reminderRecurring: true,
      reminderCalendarType: 'solar',
      reminderNotifyEmails: ['family@example.com'],
      birthDate: undefined,
    });
  });

  it('extracts the requested service name from an explicit booking sentence', () => {
    expect(
      extractDeterministicRequirements('Mình muốn đặt dịch vụ Thắp hương.'),
    ).toMatchObject({
      serviceQuery: 'Thắp hương',
    });
  });
});

describe('AI Agent pending booking reply resolution', () => {
  const basePlan = (): AgentPlan => ({
    intent: 'general_question',
    action: 'confirm_pending_action',
    contextMode: 'continue',
    needsClarification: true,
    clarificationQuestion: 'Bạn muốn chọn phương án nào?',
    requirements: {},
  });
  const collectingPlotRequest = (): AgentPendingAction => ({
    kind: 'plot_request',
    stage: 'collecting',
    plotIds: [201],
    plotCodes: ['C-02-001'],
  });

  it.each(['gửi yêu cầu', 'mình muốn đặt mua', 'mua lô đi'])(
    'continues a collecting plot request as purchase for "%s"',
    (message) => {
      expect(
        resolvePendingBookingReply(
          basePlan(),
          collectingPlotRequest(),
          message,
        ),
      ).toMatchObject({
        intent: 'plot_request',
        action: 'prepare_plot_request',
        needsClarification: false,
        requirements: { requestType: 'purchase' },
      });
    },
  );

  it.each(['giữ chỗ', 'mình chọn giữ tạm', 'đặt chỗ nhé'])(
    'continues a collecting plot request as reservation for "%s"',
    (message) => {
      expect(
        resolvePendingBookingReply(
          basePlan(),
          collectingPlotRequest(),
          message,
        ),
      ).toMatchObject({
        intent: 'plot_request',
        action: 'prepare_plot_request',
        needsClarification: false,
        requirements: { requestType: 'reserve' },
      });
    },
  );

  it('only treats submit language as confirmation after the summary is ready', () => {
    const ready: AgentPendingAction = {
      kind: 'plot_request',
      stage: 'awaiting_confirmation',
      plotIds: [201],
      plotCodes: ['C-02-001'],
      requestType: 'purchase',
    };

    expect(
      resolvePendingBookingReply(basePlan(), ready, 'gửi yêu cầu'),
    ).toMatchObject({
      intent: 'plot_request',
      action: 'confirm_pending_action',
      needsClarification: false,
    });
  });


  it.each([
    'ok đặt i',
    'ok đặt đi',
    'đặt đi',
    'mình xác nhận đặt dịch vụ này',
    'đồng ý đặt dịch vụ',
    'chốt',
  ])('keeps colloquial confirmation inside the pending service flow for "%s"', (message) => {
    const ready: AgentPendingAction = {
      kind: 'service_order',
      stage: 'awaiting_confirmation',
      serviceTypeId: 3,
      serviceName: 'Thay hoa tươi',
      plotId: 10,
      plotCode: 'A-01-002',
      quotedPrice: 150_000,
      serviceUnit: 'lần',
    };

    expect(resolvePendingBookingReply(basePlan(), ready, message)).toMatchObject({
      intent: 'service_booking',
      action: 'confirm_pending_action',
      needsClarification: false,
    });
  });

  it('does not convert a negative reply into a purchase request', () => {
    expect(
      resolvePendingBookingReply(
        basePlan(),
        collectingPlotRequest(),
        'chưa gửi yêu cầu',
      ),
    ).toEqual(basePlan());
  });
});


describe('AI Agent regression routing helpers', () => {
  const orchestrator = Object.create(
    AiAgentOrchestratorService.prototype,
  ) as any;

  it('routes a specific service booking directly to the booking flow', () => {
    expect(orchestrator.detectIntent('Mình muốn đặt dịch vụ Thắp hương.')).toBe(
      'service_booking',
    );
    const requirements = extractDeterministicRequirements(
      'Mình muốn đặt dịch vụ Thắp hương.',
    );
    expect(
      orchestrator.buildDeterministicAgentPlan(
        'Mình muốn đặt dịch vụ Thắp hương.',
        'service_booking',
        requirements,
        [],
      ),
    ).toMatchObject({
      intent: 'service_booking',
      action: 'prepare_service_order',
      requirements: { serviceQuery: 'Thắp hương' },
    });
  });

  it('routes an exact plot request without pretending it is a new recommendation', () => {
    const message = 'Mình muốn đặt yêu cầu cho phương án A-02-003.';
    const requirements = extractDeterministicRequirements(message);
    expect(orchestrator.detectIntent(message)).toBe('plot_request');
    expect(
      orchestrator.buildDeterministicAgentPlan(
        message,
        'plot_request',
        requirements,
        [],
      ),
    ).toMatchObject({
      intent: 'plot_request',
      action: 'prepare_plot_request',
      requirements: { selectedPlotCode: 'A-02-003' },
    });
  });

  it('recognizes FAQ editorial feedback even when it mentions plot recommendations', () => {
    const proposals = orchestrator.recoverExplicitKnowledgeProposal(
      'Theo tôi FAQ nên ghi rằng người dùng có thể yêu cầu AI so sánh nhiều phương án lô trước khi đặt yêu cầu.',
    );
    expect(proposals).toEqual([
      expect.objectContaining({
        memoryType: 'faq',
        requestedScope: 'global',
      }),
    ]);
  });

  it('records a real recommendation-card selection as analytics without inferring a durable preference', () => {
    const proposals = orchestrator.recoverClientActionLearningProposal({
      type: 'START_PLOT_REQUEST',
      optionId: 'OPT-002',
      recommendationRunId: 'REC-OLDER-2',
      plotIds: [11, 12],
      plotCodes: ['B-01-011', 'B-01-012'],
    });
    expect(proposals).toEqual([
      expect.objectContaining({
        memoryType: 'recommendation_feedback',
        requestedScope: 'user',
        selectedOptionId: 'OPT-002',
        recommendationRunId: 'REC-OLDER-2',
      }),
    ]);
    expect(proposals?.[0]).not.toHaveProperty('memoryKey');
    expect(proposals?.[0]).not.toHaveProperty('rejectedOptionId');
  });

  it('recovers every explicit reusable preference from one customer message', () => {
    const proposals = orchestrator.recoverExplicitUserPreferenceProposal(
      'Từ giờ nhớ giúp mình ngân sách tối đa 300 triệu, ưu tiên khu B, hướng Đông và lô gần cổng.',
    );
    expect(proposals?.map((item: { memoryKey?: string }) => item.memoryKey)).toEqual(
      expect.arrayContaining([
        'maximum_budget',
        'preferred_zone',
        'preferred_direction',
        'preferred_plot_location',
      ]),
    );
  });

  it('treats a saved-budget question as memory lookup instead of plot discovery', () => {
    expect(orchestrator.asksForSavedBudgetPreference('ngân sách t là bao nhiêu?')).toBe(
      true,
    );
    expect(orchestrator.detectIntent('ngân sách t là bao nhiêu?')).toBe(
      'general_question',
    );
  });

  it('accepts a bare birth-time reply inside an active Bazi turn', () => {
    const result = orchestrator.contextualizeClarificationReply(
      '11h35p',
      [
        { role: 'user', content: 'Tư vấn Bát Tự cho tui' },
        { role: 'assistant', content: 'Bạn cho mình thêm giờ sinh nếu biết.' },
      ],
      { birthDate: '2006-01-16', gender: 'male' },
      'general_question',
      true,
    );
    expect(result).toMatchObject({
      intent: 'bazi_suggestion',
      requirements: { birthTime: '11:35' },
    });
  });

  it('rotates previously shown plots when the customer asks for another recommendation', () => {
    const result = orchestrator.contextualizeClarificationReply(
      'Gợi ý cho mình thêm vài lô đi',
      [
        {
          role: 'assistant',
          content: 'Mình có ba phương án phù hợp.',
          metadata: {
            recommendations: [
              { plotIds: [5], plotCodes: ['A-02-005'] },
              { plotIds: [1], plotCodes: ['A-02-001'] },
              { plotIds: [3], plotCodes: ['A-02-003'] },
            ],
          },
        },
      ],
      {},
      'recommend_plots',
      false,
    );
    expect(result.requirements.excludePlotIds).toEqual(
      expect.arrayContaining([1, 3, 5]),
    );
  });
});
