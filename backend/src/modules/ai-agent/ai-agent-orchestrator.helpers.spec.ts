import { AgentPlan } from './agent-planner';
import {
  extractDeterministicRequirements,
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
      ...collectingPlotRequest(),
      stage: 'awaiting_confirmation',
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
