import { AgentPlan } from './agent-planner';
import {
  AiAgentOrchestratorService,
  extractDeterministicRequirements,
  extractExplicitBudgetBounds,
  extractSemanticStructuredFacts,
  extractPendingServiceRequestedDate,
  extractRequestedRecommendationCount,
  buildInvalidExplicitDateTimeResponse,
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
      extractPendingServiceRequestedDate(
        'Mình muốn dùng dịch vụ mai táng.',
        now,
      ),
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

describe('explicit date/time validation', () => {
  it('rejects an impossible standalone appointment clock', () => {
    expect(buildInvalidExplicitDateTimeResponse('đặt lúc 25:00')).toContain(
      '25:00 không hợp lệ',
    );
  });

  it('reports both an impossible date and clock in one natural request', () => {
    const response = buildInvalidExplicitDateTimeResponse(
      'đặt lịch xem vào 31/02 lúc 25 giờ',
    );
    expect(response).toContain('31/02 không tồn tại');
    expect(response).toContain('25 giờ không hợp lệ');
  });
});

describe('AI Agent semantic-mode hard facts', () => {
  it('does not let a negotiated amount become a hard budget just because it has a currency unit', () => {
    const message = 'Lô A-02-005 mắc quá, 5 triệu bán không?';
    const deterministic = extractDeterministicRequirements(message);

    expect(deterministic.budgetMax).toBe(5_000_000); // legacy outage parser may still see it
    expect(extractSemanticStructuredFacts(message, deterministic)).toEqual({
      selectedPlotCode: 'A-02-005',
    });
  });

  it('keeps an explicitly labelled budget range as deterministic numeric facts', () => {
    expect(
      extractExplicitBudgetBounds(
        'ngân sách tầm 100 đến 200 triệu, có lô nào yên tĩnh không',
      ),
    ).toEqual({ budgetMin: 100_000_000, budgetMax: 200_000_000 });
  });

  it('does not hard-code family, adjacency, access, direction or option-count semantics before the LLM', () => {
    const message =
      'Gia đình tui muốn coi 3 lô hướng Đông, đi lại tiện hơn chút để tham khảo.';
    const deterministic = extractDeterministicRequirements(message);
    const facts = extractSemanticStructuredFacts(message, deterministic);

    // The legacy extractor may expose compatibility hints, but none of these
    // semantic roles may become a hard fact before the planner understands the
    // complete sentence.
    expect(facts).toEqual({});
  });

  it('keeps exact plot identifiers hard while leaving the requested action semantic', () => {
    const message = 'A-01-004 này sổ hồng thế nào bạn?';
    const deterministic = extractDeterministicRequirements(message);
    expect(extractSemanticStructuredFacts(message, deterministic)).toEqual({
      selectedPlotCode: 'A-01-004',
    });
  });

  it('preserves an explicit mistyped near-entrance preference and unverifiable wishes', () => {
    const message = 'tui muốn chọn lô hợp lý, tui thích aganf cổng thoáng mát';
    const deterministic = extractDeterministicRequirements(message);

    expect(deterministic.preferNearEntrance).toBe(true);
    expect(
      extractSemanticStructuredFacts(message, deterministic),
    ).toMatchObject({
      preferNearEntrance: true,
      qualitativePreferences: ['thoáng mát'],
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

  it('extracts a year-only birth input without mistaking accentless "sinh nam" for male gender', () => {
    expect(
      extractDeterministicRequirements(
        'ong tui sinh nam 1952 tuoi Nham Thin, coi huong hop giup tui',
      ),
    ).toMatchObject({
      birthYear: 1952,
      gender: undefined,
    });
  });

  it('keeps the latest explicitly corrected birth year', () => {
    const requirements = extractDeterministicRequirements(
      't sinh năm 2000, à nhầm 2001, nữ',
    );
    expect(requirements).toMatchObject({ birthYear: 2001, gender: 'female' });
    expect(
      extractSemanticStructuredFacts(
        't sinh năm 2000, à nhầm 2001, nữ',
        requirements,
      ),
    ).toMatchObject({
      birthYear: 2001,
    });
  });

  it('keeps an explicit acquisition quantity as a trusted structured fact', () => {
    const message = 'nhà tui cần 2 lô nằm sát nhau; cho tui 3 phương án';
    const requirements = extractDeterministicRequirements(message);
    expect(extractSemanticStructuredFacts(message, requirements)).toMatchObject(
      {
        numberOfPlots: 2,
        needAdjacent: true,
      },
    );
  });

  it.each([
    ['tui nữ, sinh 12/03/1999 tầm 7 giờ sáng', '07:00'],
    ['nam sinh 04/05/1988 khoảng 7 giờ tối', '19:00'],
  ])('keeps a natural-language birth clock from "%s"', (message, birthTime) => {
    const deterministic = extractDeterministicRequirements(message);

    expect(deterministic).toMatchObject({ birthTime });
    expect(
      extractSemanticStructuredFacts(message, deterministic),
    ).toMatchObject({
      birthTime,
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
      appointmentTopic: 'Hẹn xem lô đất A-01-001',
      birthDate: undefined,
    });
  });

  it('extracts the complete appointment range and ignores other appointment reasons', () => {
    expect(
      extractDeterministicRequirements(
        'Mình muốn đặt lịch với ban quản lý vào ngày 2026-08-22, từ 14:30 đến 15:45. Nội dung: Trao đổi hợp đồng lô B-02-004.',
      ),
    ).toMatchObject({
      selectedPlotCode: 'B-02-004',
      appointmentDate: '2026-08-22',
      appointmentStartTime: '14:30',
      appointmentEndTime: '15:45',
      appointmentTopic: 'Hẹn xem lô đất B-02-004',
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

describe('clarification requirement continuity', () => {
  it('treats a short reply as one filled slot instead of resetting plot criteria', () => {
    const orchestrator = Object.create(
      AiAgentOrchestratorService.prototype,
    ) as unknown as {
      restoreRequirementsForContinuation: (
        plan: AgentPlan,
        history: unknown[],
      ) => AgentPlan;
    };
    const plan: AgentPlan = {
      intent: 'bazi_suggestion',
      action: 'suggest_bazi_direction',
      contextMode: 'continue',
      needsClarification: false,
      clarificationQuestion: '',
      requirements: {
        gender: 'male',
        consultationGoal: 'bazi_then_plots',
      },
    };
    const result = orchestrator.restoreRequirementsForContinuation(plan, [
      {
        role: 'assistant',
        intent: 'clarification',
        extractedData: {
          birthDate: '2006-03-02',
          birthTime: '13:45',
          preferNearEntrance: true,
          qualitativePreferences: ['thoáng mát'],
        },
      },
    ]);

    expect(result.requirements).toMatchObject({
      birthDate: '2006-03-02',
      birthTime: '13:45',
      gender: 'male',
      consultationGoal: 'bazi_then_plots',
      preferNearEntrance: true,
      qualitativePreferences: ['thoáng mát'],
    });
  });

  it('keeps the active request ledger for a reasoning follow-up after recommendations', () => {
    const orchestrator = Object.create(
      AiAgentOrchestratorService.prototype,
    ) as unknown as {
      restoreRequirementsForContinuation: (
        plan: AgentPlan,
        history: unknown[],
      ) => AgentPlan;
    };
    const plan: AgentPlan = {
      intent: 'general_question',
      action: 'none',
      contextMode: 'continue',
      needsClarification: false,
      clarificationQuestion: '',
      directResponse: 'H-02-005 phù hợp nhất.',
      requirements: {},
    };

    const result = orchestrator.restoreRequirementsForContinuation(plan, [
      {
        role: 'assistant',
        intent: 'recommend_plots',
        extractedData: {
          preferredDirection: 'Nam',
          preferNearEntrance: true,
          qualitativePreferences: ['thoáng mát'],
          excludePlotIds: [1, 2],
        },
      },
    ]);

    expect(result.requirements).toMatchObject({
      preferredDirection: 'Nam',
      preferNearEntrance: true,
      qualitativePreferences: ['thoáng mát'],
    });
    expect(result.requirements).not.toHaveProperty('excludePlotIds');
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

  it('only treats submit language as confirmation after the summary is ready', () => {
    const ready: AgentPendingAction = {
      kind: 'plot_request',
      stage: 'awaiting_confirmation',
      plotIds: [201],
      plotCodes: ['C-02-001'],
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
  ])(
    'keeps colloquial confirmation inside the pending service flow for "%s"',
    (message) => {
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

      expect(
        resolvePendingBookingReply(basePlan(), ready, message),
      ).toMatchObject({
        intent: 'service_booking',
        action: 'confirm_pending_action',
        needsClarification: false,
      });
    },
  );

  it('does not convert a negative reply into a purchase request', () => {
    expect(
      resolvePendingBookingReply(
        basePlan(),
        collectingPlotRequest(),
        'chưa gửi yêu cầu',
      ),
    ).toEqual(basePlan());
  });

  it('keeps selecting one of several cancellation candidates in the cancellation flow', () => {
    const pending: AgentPendingAction = {
      kind: 'service_order',
      operation: 'cancel',
      stage: 'collecting',
      candidateOrderIds: [52, 51],
    };

    expect(
      resolvePendingBookingReply(basePlan(), pending, 'chọn cái thứ 2'),
    ).toMatchObject({
      intent: 'service_booking',
      action: 'cancel_service_order',
      needsClarification: false,
    });
  });
});

describe('AI Agent regression routing helpers', () => {
  const orchestrator = Object.create(
    AiAgentOrchestratorService.prototype,
  ) as any;

  it('rejects a wrong year pillar inside a compound Bazi recommendation result', () => {
    const toolOutput = {
      recommendations: [],
      baziSuggestion: { yearPillar: 'Kỷ Mão' },
    };

    expect(
      orchestrator.isUsableBaziComposedResponse(
        'Bạn sinh năm 1999, tuổi Canh Thìn.',
        { birthYear: 1999 },
        toolOutput,
      ),
    ).toBe(false);
    expect(
      orchestrator.isUsableBaziComposedResponse(
        'Bạn sinh năm 1999, tuổi Kỷ Mão.',
        { birthYear: 1999 },
        toolOutput,
      ),
    ).toBe(true);
  });

  it('requires a complete Bát Trạch narrative for a standalone analysis', () => {
    const toolOutput = {
      yearPillar: 'Bính Tuất',
      napAmName: 'Ốc Thượng Thổ',
      cungMenh: 'Chấn',
      goodDirections: [
        { direction: 'Nam', star: 'Sinh Khí' },
        { direction: 'Bắc', star: 'Thiên Y' },
      ],
      badDirections: [
        { direction: 'Tây', star: 'Tuyệt Mệnh' },
        { direction: 'Tây Bắc', star: 'Ngũ Quỷ' },
      ],
    };
    expect(
      orchestrator.isUsableBaziComposedResponse(
        'Bạn sinh năm 2006, tuổi Bính Tuất, ưu tiên hướng Nam.',
        { birthYear: 2006 },
        toolOutput,
        true,
      ),
    ).toBe(false);

    const detailed = `Bạn sinh năm 2006, tuổi Bính Tuất. Nạp Âm Ốc Thượng Thổ và Cung Mệnh Chấn là hai lớp tham khảo khác nhau trong phép Bát Trạch. Hướng Nam mang sao Sinh Khí, thường được diễn giải theo sức sống và sự phát triển; hướng Bắc mang sao Thiên Y, nhấn vào sự nâng đỡ. Hướng Tây thuộc Tuyệt Mệnh và hướng Tây Bắc thuộc Ngũ Quỷ là các nhãn văn hóa nên hạn chế, không phải dự báo chắc chắn. Ngũ Hành chỉ là lớp giải thích phụ và không được dùng để phủ định bảng hướng Bát Trạch. Khi chọn lô thực tế vẫn cần đối chiếu giá, diện tích, khu vực, lối tiếp cận và tình trạng còn trống từ dữ liệu xác thực. Đây là nội dung tham khảo văn hóa, không phải kết luận khoa học. Giới hạn của phép tính hiện tại là chưa lập đủ Tứ Trụ năm, tháng, ngày, giờ và không thay thế tư vấn chuyên gia. ${'Phần giải thích này trình bày từng lớp dữ liệu để gia đình cân nhắc thận trọng và tránh biến một hướng tham khảo thành bảo đảm tốt xấu. '.repeat(2)}`;
    expect(
      orchestrator.isUsableBaziComposedResponse(
        detailed,
        { birthYear: 2006 },
        toolOutput,
        true,
      ),
    ).toBe(true);
  });

  it('asks for budget after Bát Trạch instead of browsing arbitrary plots', () => {
    const bazi = { preferredDirections: ['Nam'] };
    expect(
      orchestrator.buildBaziPlotDiscoveryQuestion(
        {
          birthDate: '2006-03-02',
          gender: 'male',
          consultationGoal: 'bazi_then_plots',
        },
        bazi,
        'nam sinh 2/3/2006, chọn lô hợp hướng giúp mình',
      ),
    ).toContain('ngân sách');
    expect(
      orchestrator.buildBaziPlotDiscoveryQuestion(
        {
          birthDate: '2006-03-02',
          gender: 'male',
          consultationGoal: 'bazi_then_plots',
          budgetMax: 100_000_000,
          numberOfPlots: 1,
        },
        bazi,
        'ngân sách 100 triệu, một lô hợp hướng',
      ),
    ).toBe('');
    expect(
      orchestrator.buildBaziPlotDiscoveryQuestion(
        {
          birthDate: '2006-03-02',
          gender: 'male',
          consultationGoal: 'bazi_then_plots',
          budgetMax: 100_000_000,
          numberOfPlots: 1,
        },
        bazi,
        'ngân sách 100 triệu, một lô hợp hướng',
        true,
      ),
    ).toContain('xác nhận');
  });

  it('rebuilds a plot-choice follow-up without inventing budget or access differences', () => {
    const shared = {
      plots: [],
      score: 1,
      plotCost: 23_000_000,
      serviceCost: 0,
      estimatedTotal: 23_000_000,
      currency: 'VND',
      zoneName: 'Khu F',
      directions: ['Tây'],
      totalAreaSqm: 2.4,
      isAdjacent: false,
      reasons: [],
      tradeOffs: [],
      analysisSummary: '',
      highlightPlotIds: [],
      accessSummary: 'Khoảng tiếp cận trung bình tới Cổng chính',
      entranceDistanceMapUnits: null,
    };
    const history = [
      {
        role: 'assistant',
        extractedData: { budgetMax: 250_000_000 },
        metadata: {
          recommendations: [
            {
              ...shared,
              optionId: 'A',
              plotIds: [1],
              plotCodes: ['F-01-006'],
            },
            {
              ...shared,
              optionId: 'B',
              plotIds: [2],
              plotCodes: ['F-02-001'],
            },
          ],
        },
      },
    ];

    const answer = orchestrator.buildGroundedPlotDecisionFollowUp(
      history,
      'Chọn F-01-006 vì gần cổng hơn; F-02-001 kém hơn.',
    );

    expect(answer).toContain('F-01-006');
    expect(answer).toContain('nằm trong ngân sách 250.000.000 VND');
    expect(answer).toContain('không chứng minh F-01-006 có lợi thế vị trí hơn');
    expect(answer).not.toContain('vượt ngân sách');
  });

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

  it('routes cancellation of an already-created service order deterministically', () => {
    expect(
      orchestrator.buildDeterministicAgentPlan(
        'Hủy đơn dịch vụ #52 vừa đặt giúp mình.',
        'service_suggestions',
        {},
        [],
      ),
    ).toMatchObject({
      intent: 'service_booking',
      action: 'cancel_service_order',
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

  it('routes birth details plus a burial-plot question through Bát Tự without requiring the keyword', () => {
    const message = 'Mình sinh ngày 12/03/1999, nữ, nên chôn ở lô nào thì hợp?';

    expect(orchestrator.isBirthProfilePlotConsultation(message)).toBe(true);
    expect(orchestrator.detectIntent(message)).toBe('bazi_suggestion');
  });

  it('applies prior Bát Tự facts only after the LLM directs a plot continuation', () => {
    const history = [
      {
        role: 'assistant',
        intent: 'bazi_suggestion',
        content: 'Các hướng phù hợp đã được phân tích.',
        extractedData: {
          birthDate: '1999-03-12',
          gender: 'female',
        },
        metadata: {
          baziSuggestion: {
            preferredDirections: ['Đông', 'Đông Nam'],
            yearPillar: 'Kỷ Mão',
            element: 'Thổ',
            cungMenh: 'Cấn',
          },
        },
      },
    ];
    const directed = orchestrator.applyPlannerDirectedContinuation(
      {
        intent: 'recommend_plots',
        action: 'browse_available_plots',
        contextMode: 'continue',
        needsClarification: false,
        clarificationQuestion: '',
        directResponse: '',
        requirements: { consultationGoal: 'bazi_then_plots' },
      },
      history,
    );

    expect(directed).toMatchObject({
      intent: 'bazi_suggestion',
      action: 'suggest_bazi_direction',
      requirements: {
        consultationGoal: 'bazi_then_plots',
        birthDate: '1999-03-12',
        gender: 'female',
      },
    });
    expect(
      orchestrator.applyPlannerDirectedContinuation(
        {
          ...directed,
          intent: 'general_question',
          action: 'none',
          requirements: {},
        },
        history,
      ).requirements,
    ).toEqual({});
  });

  it('exposes compact structured Bát Tự state to the next semantic planner turn', () => {
    const state = orchestrator.buildRecentStructuredConversationState([
      {
        role: 'assistant',
        intent: 'bazi_suggestion',
        content: 'Đã phân tích Bát Trạch.',
        extractedData: {
          birthYear: 1952,
          gender: 'male',
          consultationGoal: 'bazi_then_plots',
          pendingAction: { kind: 'plot_request', plotIds: [99] },
        },
        metadata: {
          baziSuggestion: {
            preferredDirections: ['Bắc'],
            yearPillar: 'Nhâm Thìn',
            element: 'Thủy',
            cungMenh: 'Chấn',
          },
        },
      },
    ]);

    expect(state[0]).toMatchObject({
      intent: 'bazi_suggestion',
      requirements: {
        birthYear: 1952,
        gender: 'male',
        consultationGoal: 'bazi_then_plots',
      },
      baziResult: { preferredDirections: ['Bắc'] },
    });
    expect(state[0].requirements).not.toHaveProperty('pendingAction');
  });

  it('does not require optional birth time when date and gender already suffice', () => {
    const intake = orchestrator.buildBaziIntakeTurn({
      message: 'Mình sinh ngày 12/03/1999, nữ, nên chôn ở lô nào?',
      intent: 'bazi_suggestion',
      requirements: {
        birthDate: '1999-03-12',
        gender: 'female',
        consultationGoal: 'bazi_then_plots',
      },
      directRequirements: {
        birthDate: '1999-03-12',
        gender: 'female',
      },
      customerProfile: null,
    });

    expect(intake).toBeNull();
  });

  it('turns natural consultation feedback into an admin-review proposal', () => {
    const proposals = orchestrator.recoverExplicitKnowledgeProposal(
      'Mình góp ý là AI phải hỏi giờ sinh trước khi tư vấn Bát Tự, chứ đừng tự phân tích luôn.',
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        category: 'Hành vi tư vấn AI',
        memoryType: 'business_rule',
        requestedScope: 'global',
      }),
    ]);

    expect(
      orchestrator.recoverExplicitKnowledgeProposal(
        'Tui góp ý là nó phải hiểu ngày sinh với câu hỏi lô nào là tư vấn Bát Tự và phải hỏi giờ sinh.',
      ),
    ).toEqual([expect.objectContaining({ memoryType: 'business_rule' })]);
  });

  it('keeps a reported conversational misunderstanding out of admin review', () => {
    const proposals = orchestrator.recoverExplicitKnowledgeProposal(
      'Bạn hiểu sai ý mình rồi, câu trả lời vừa rồi không đúng; mình đang hỏi lô phù hợp theo ngày sinh.',
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        category: 'Sửa lỗi hiểu ngữ cảnh',
        memoryType: 'conversation_correction',
        requestedScope: 'user',
      }),
    ]);

    expect(
      orchestrator.recoverExplicitKnowledgeProposal(
        'M bắt sai ý tui rồi, m phải hiểu là tui đang góp ý chứ không nhờ coi lô.',
      ),
    ).toEqual([
      expect.objectContaining({
        memoryType: 'conversation_correction',
        requestedScope: 'user',
      }),
    ]);
  });

  it('still sends authoritative factual corrections for administrator verification', () => {
    const proposals = orchestrator.recoverExplicitKnowledgeProposal(
      'Bạn nói sai giá lô A-01-001 rồi, giá đúng phải là 120 triệu.',
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        category: 'Hiệu chỉnh thông tin nghiệp vụ',
        memoryType: 'information_correction',
        requestedScope: 'global',
      }),
    ]);
  });

  it('turns bargaining into a dedicated price proposal with plot and offer details', () => {
    const proposals = orchestrator.recoverExplicitKnowledgeProposal(
      'Lô A-01-002 bớt còn 100 triệu được không?',
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        memoryType: 'price_proposal',
        requestedScope: 'global',
        targetPlotCode: 'A-01-002',
        proposedPrice: 100_000_000,
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
    expect(
      proposals?.map((item: { memoryKey?: string }) => item.memoryKey),
    ).toEqual(
      expect.arrayContaining([
        'maximum_budget',
        'preferred_zone',
        'preferred_direction',
        'preferred_plot_location',
      ]),
    );
  });

  it('treats a saved-budget question as memory lookup instead of plot discovery', () => {
    expect(
      orchestrator.asksForSavedBudgetPreference('ngân sách t là bao nhiêu?'),
    ).toBe(true);
    expect(orchestrator.detectIntent('ngân sách t là bao nhiêu?')).toBe(
      'general_question',
    );
  });

  it('keeps a standalone Bát Tự request separate from plot discovery', () => {
    expect(
      orchestrator.isExplicitBaziOnlyTurn('Tư vấn Bát Tự cho mình thôi.'),
    ).toBe(true);
    expect(
      orchestrator.isExplicitBaziOnlyTurn(
        'Phân tích Bát Tự rồi lọc lô phù hợp cho mình.',
      ),
    ).toBe(false);
  });

  it('does not revive an old Bát Tự-then-plots goal after a newer standalone Bát Tự turn', () => {
    const requirements = orchestrator.extractRequirementsFromHistory([
      {
        role: 'assistant',
        intent: 'bazi_suggestion',
        extractedData: {
          consultationGoal: 'bazi_then_plots',
          birthDate: '2006-01-16',
        },
      },
      {
        role: 'assistant',
        intent: 'bazi_suggestion',
        extractedData: { birthDate: '2006-01-16', gender: 'male' },
      },
    ]);

    expect(requirements.consultationGoal).toBeUndefined();
  });

  it('extracts a bare clock while leaving its conversational role to the planner', () => {
    expect(extractDeterministicRequirements('11h35p')).toMatchObject({
      birthTime: '11:35',
    });
  });

  it('collects previously shown plot ids after the planner requests fresh options', () => {
    const ids = orchestrator.getPreviouslyRecommendedPlotIds([
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
    ]);
    expect(ids).toEqual(expect.arrayContaining([1, 3, 5]));
  });
});
