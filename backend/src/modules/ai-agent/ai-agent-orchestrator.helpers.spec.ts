import { AgentPlan } from './agent-planner';
import {
  extractDeterministicRequirements,
  extractRequestedRecommendationCount,
  resolvePendingBookingReply,
} from './ai-agent-orchestrator.service';
import { AgentPendingAction } from './types/agent-response.types';

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
