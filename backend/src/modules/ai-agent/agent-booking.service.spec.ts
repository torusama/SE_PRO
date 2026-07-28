import { AgentBookingService } from './agent-booking.service';
import { AgentPlan, AgentPlanAction, AgentPlanIntent } from './agent-planner';
import { AgentPendingAction } from './types/agent-response.types';

function plan(
  action: AgentPlanAction,
  intent: AgentPlanIntent,
  requirements: AgentPlan['requirements'] = {},
): AgentPlan {
  return {
    action,
    intent,
    requirements,
    contextMode: 'continue',
    needsClarification: false,
    clarificationQuestion: '',
  };
}

function createService() {
  const database = {
    query: jest.fn(),
    queryOne: jest.fn(),
  };
  const reservations = {
    create: jest.fn(),
    releaseExpiredReservations: jest.fn().mockResolvedValue({
      requestsCancelled: 0,
      plotsReleased: 0,
    }),
  };
  const cemeteryServices = {
    serviceTypes: jest.fn().mockResolvedValue([
      {
        id: 3,
        name: 'Dọn dẹp mộ',
        description: 'Vệ sinh khu vực phần mộ',
        basePrice: 200_000,
        unit: 'lần',
        category: 'maintenance',
      },
    ]),
    createOrder: jest.fn(),
  };
  return {
    database,
    reservations,
    cemeteryServices,
    service: new AgentBookingService(
      database as never,
      reservations as never,
      cemeteryServices as never,
    ),
  };
}

describe('AgentBookingService', () => {
  it('asks for authentication before starting a protected request', async () => {
    const { service } = createService();
    const result = await service.handleTurn({
      conversationId: 1,
      userId: null,
      plan: plan('prepare_plot_request', 'plot_request'),
      clientAction: {
        type: 'START_PLOT_REQUEST',
        optionId: 'OPT-1',
        plotIds: [10],
        plotCodes: ['A-01-001'],
      },
    });

    expect(result?.assistantMessage).toContain('đăng nhập');
    expect(result?.pendingAction).toBeUndefined();
  });

  it('uses the selected recommendation and asks only for request type', async () => {
    const { service, database } = createService();
    database.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM ai_messages')) {
        return Promise.resolve([
          {
            metadata: {
              recommendations: [
                {
                  optionId: 'OPT-1',
                  plotIds: [10],
                  plotCodes: ['A-01-001'],
                },
              ],
            },
          },
        ]);
      }
      if (sql.includes('FROM plots')) {
        return Promise.resolve([
          {
            plotId: 10,
            plotCode: 'A-01-001',
            price: 90_000_000,
            status: 'available',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_plot_request', 'plot_request'),
      clientAction: {
        type: 'START_PLOT_REQUEST',
        optionId: 'OPT-1',
        plotIds: [10],
        plotCodes: ['A-01-001'],
      },
    });

    expect(result?.assistantMessage).toContain('giữ chỗ tạm thời');
    expect(result?.pendingAction).toMatchObject({
      kind: 'plot_request',
      stage: 'collecting',
      plotIds: [10],
      plotCodes: ['A-01-001'],
    });
  });

  it('creates a plot request only after final confirmation', async () => {
    const { service, reservations, database } = createService();
    reservations.create.mockResolvedValue({ id: 88, status: 'pending' });
    database.query.mockResolvedValue([
      {
        plotId: 10,
        plotCode: 'A-01-001',
        price: 90_000_000,
        status: 'available',
      },
    ]);
    const pending: AgentPendingAction = {
      kind: 'plot_request',
      stage: 'awaiting_confirmation',
      plotIds: [10],
      plotCodes: ['A-01-001'],
      requestType: 'purchase',
      quotedTotal: 90_000_000,
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'plot_request'),
      pendingAction: pending,
    });

    expect(reservations.create).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        type: 'purchase',
        plotIds: [10],
      }),
      false,
      90_000_000,
    );
    expect(result?.assistantMessage).toContain('#88');
    expect(result?.pendingAction).toBeUndefined();
  });

  it('requires confirmation again when the quoted plot price changes', async () => {
    const { service, reservations, database } = createService();
    database.query.mockResolvedValue([
      {
        plotId: 10,
        plotCode: 'A-01-001',
        price: 95_000_000,
        status: 'available',
      },
    ]);
    const pending: AgentPendingAction = {
      kind: 'plot_request',
      stage: 'awaiting_confirmation',
      plotIds: [10],
      plotCodes: ['A-01-001'],
      requestType: 'purchase',
      quotedTotal: 90_000_000,
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'plot_request'),
      pendingAction: pending,
    });

    expect(reservations.create).not.toHaveBeenCalled();
    expect(result?.assistantMessage).toContain('đã thay đổi');
    expect(result?.pendingAction).toMatchObject({
      kind: 'plot_request',
      quotedTotal: 95_000_000,
    });
  });

  it('explains a sold plot code and suggests available alternatives', async () => {
    const { service, reservations, database } = createService();
    database.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM ai_messages')) return Promise.resolve([]);
      if (sql.includes('FROM vw_plots_map')) {
        return Promise.resolve([{ plotCode: 'A-01-002', price: 92_000_000 }]);
      }
      return Promise.resolve([]);
    });
    database.queryOne.mockResolvedValue({
      plotId: 10,
      plotCode: 'A-01-001',
      status: 'sold',
      zoneId: 1,
      plotType: 'family',
      price: 90_000_000,
    });

    await expect(
      service.handleTurn({
        conversationId: 1,
        userId: 7,
        plan: plan('prepare_plot_request', 'plot_request', {
          selectedPlotCode: 'A-01-001',
          requestType: 'purchase',
        }),
      }),
    ).rejects.toThrow(/đã được mua.*A-01-002/);

    expect(reservations.releaseExpiredReservations).toHaveBeenCalled();
    expect(reservations.create).not.toHaveBeenCalled();
  });

  it('does not start a service order when the account has no owned plot', async () => {
    const { service, database } = createService();
    database.query.mockResolvedValue([]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceTypeId: 3,
      }),
    });

    expect(result?.assistantMessage).toContain('chưa có lô nào');
    expect(result?.pendingAction).toBeUndefined();
  });

  it('asks which owned plot to use when the account has multiple plots', async () => {
    const { service, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
      { plotId: 11, plotCode: 'B-01-002', zoneName: 'Khu B' },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceTypeId: 3,
      }),
    });

    expect(result?.assistantMessage).toContain('A-01-001');
    expect(result?.assistantMessage).toContain('B-01-002');
    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      serviceTypeId: 3,
      serviceName: 'Dọn dẹp mộ',
    });
  });

  it('reuses the single owned plot and account profile in the final service summary', async () => {
    const { service, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
    ]);
    database.queryOne.mockResolvedValue({
      fullName: 'An Võ',
      phone: '0900000000',
      email: 'an@example.com',
    });

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceTypeId: 3,
        requestedDate: '2099-08-10',
      }),
    });

    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      stage: 'awaiting_confirmation',
      plotId: 10,
      plotCode: 'A-01-001',
    });
    expect(result?.assistantMessage).toContain('An Võ');
    expect(result?.assistantMessage).toContain('A-01-001');
    expect(result?.assistantMessage).toContain('2099-08-10');
  });

  it('rejects an impossible calendar date and asks for a valid one', async () => {
    const { service, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceTypeId: 3,
        requestedDate: '2099-02-31',
      }),
    });

    expect(result?.assistantMessage).toContain('không hợp lệ');
    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      requestedDate: undefined,
    });
  });

  it('creates a service order after the customer confirms the summary', async () => {
    const { service, cemeteryServices } = createService();
    cemeteryServices.createOrder.mockResolvedValue({ id: 45 });
    const pending: AgentPendingAction = {
      kind: 'service_order',
      stage: 'awaiting_confirmation',
      serviceTypeId: 3,
      serviceName: 'Dọn dẹp mộ',
      plotId: 10,
      plotCode: 'A-01-001',
      requestedDate: '2099-08-10',
      quotedPrice: 200_000,
      serviceUnit: 'lần',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      pendingAction: pending,
    });

    expect(cemeteryServices.createOrder).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        serviceTypeId: 3,
        plotId: 10,
        requestedDate: '2099-08-10',
      }),
    );
    expect(result?.assistantMessage).toContain('#45');
  });

  it('requires confirmation again when the service price changes', async () => {
    const { service, cemeteryServices } = createService();
    const pending: AgentPendingAction = {
      kind: 'service_order',
      stage: 'awaiting_confirmation',
      serviceTypeId: 3,
      serviceName: 'Dọn dẹp mộ',
      plotId: 10,
      plotCode: 'A-01-001',
      requestedDate: '2099-08-10',
      quotedPrice: 150_000,
      serviceUnit: 'lần',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      pendingAction: pending,
    });

    expect(cemeteryServices.createOrder).not.toHaveBeenCalled();
    expect(result?.assistantMessage).toContain('đã thay đổi');
    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      quotedPrice: 200_000,
      serviceUnit: 'lần',
    });
  });
});
