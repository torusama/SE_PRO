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
    myOrders: jest.fn(),
    cancelByCustomer: jest.fn(),
  };
  const reminders = {
    create: jest.fn(),
  };
  const schedule = {
    bookAppointment: jest.fn(),
  };
  const memorialDrafts = {
    generate: jest.fn().mockImplementation(({ fallback }) => fallback),
  };
  return {
    database,
    reservations,
    cemeteryServices,
    reminders,
    schedule,
    memorialDrafts,
    service: new AgentBookingService(
      database as never,
      reservations as never,
      cemeteryServices as never,
      reminders as never,
      schedule as never,
      memorialDrafts as never,
    ),
  };
}

describe('AgentBookingService', () => {
  it('converts a stored legacy hold draft back to the current purchase review flow', async () => {
    const { service, database } = createService();
    database.queryOne.mockResolvedValue({
      pendingAction: {
        kind: 'plot_request',
        stage: 'awaiting_confirmation',
        plotIds: [10],
        plotCodes: ['A-01-001'],
        requestType: 'reserve',
        quotedTotal: 90_000_000,
      },
    });

    const pending = await service.loadPendingAction(1);

    expect(pending).toMatchObject({
      kind: 'plot_request',
      stage: 'collecting',
      plotIds: [10],
      plotCodes: ['A-01-001'],
    });
    expect(pending).not.toHaveProperty('requestType');
  });

  it('does not let an unfinished appointment swallow an unrelated LLM turn', async () => {
    const { service, database, schedule } = createService();
    const pending: AgentPendingAction = {
      kind: 'appointment',
      stage: 'collecting',
      selectedPlotCode: 'A-01-001',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('none', 'general_question'),
      userMessage: 'người tuổi chó nằm đâu ok',
      pendingAction: pending,
    });

    expect(result).toBeNull();
    expect(database.query).not.toHaveBeenCalled();
    expect(database.queryOne).not.toHaveBeenCalled();
    expect(schedule.bookAppointment).not.toHaveBeenCalled();
  });

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

  it('uses the selected recommendation and prepares a purchase request', async () => {
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
    database.queryOne.mockResolvedValue({
      fullName: 'An Võ',
      phone: '0900000000',
      email: 'an@example.com',
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

    expect(result?.assistantMessage).toContain('Gửi yêu cầu mua');
    expect(result?.assistantMessage).not.toContain('giữ chỗ');
    expect(result?.pendingAction).toMatchObject({
      kind: 'plot_request',
      stage: 'awaiting_confirmation',
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
    expect(result?.quickReplies).toEqual([
      expect.objectContaining({
        id: 'service-no-owned-plot-consultation',
        label: 'Tư vấn thêm về lô đất phù hợp',
        emphasis: 'strong',
      }),
    ]);
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
    expect(result?.quickReplies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'service-confirm-order',
          label: 'Xác nhận đặt dịch vụ',
        }),
      ]),
    );

    expect(result?.assistantMessage).toContain('An Võ');
    expect(result?.assistantMessage).toContain('A-01-001');
    expect(result?.assistantMessage).toContain('2099-08-10');
  });

  it('asks for the preferred service date before allowing confirmation', async () => {
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
      }),
    });

    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      stage: 'collecting',
      plotId: 10,
      requestedDate: undefined,
    });
    expect(result?.assistantMessage).toContain(
      'Bạn muốn dịch vụ được thực hiện vào ngày nào?',
    );
    expect(result?.quickReplies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'service-date-tomorrow' }),
      ]),
    );
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

  it('creates a service order and opens the right-side checkout after confirmation', async () => {
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
    expect(result?.assistantMessage).toContain(
      'không cần xác nhận ngày thêm lần nữa',
    );
    expect(result?.uiDirective).toEqual({
      type: 'SHOW_INLINE_SERVICE_PAYMENT',
      serviceTypeId: 3,
      orderId: 45,
      amount: 200_000,
      paymentStatus: 'unpaid',
    });
    expect(result?.quickReplies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Đặt thêm dịch vụ' }),
        expect.objectContaining({ label: 'Hủy đơn #45' }),
      ]),
    );
  });

  it('does not trust a planner-invented service date that the customer never said', async () => {
    const { service, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceTypeId: 3,
        requestedDate: '2099-08-10',
      }),
      userMessage: 'Đặt giúp mình dịch vụ dọn dẹp mộ.',
    });

    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      stage: 'collecting',
      requestedDate: undefined,
    });
    expect(result?.assistantMessage).toContain(
      'Bạn muốn dịch vụ được thực hiện vào ngày nào?',
    );
  });

  it('collects and confirms a separate date for every queued service before opening payment', async () => {
    const { service, cemeteryServices, database } = createService();
    cemeteryServices.serviceTypes.mockResolvedValue([
      {
        id: 3,
        name: 'Dọn dẹp mộ',
        description: 'Vệ sinh khu vực phần mộ',
        basePrice: 200_000,
        unit: 'lần',
        category: 'maintenance',
      },
      {
        id: 4,
        name: 'Thắp hương',
        description: 'Thắp hương tại phần mộ',
        basePrice: 100_000,
        unit: 'lần',
        category: 'ritual',
      },
    ]);
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
    ]);

    const started = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        serviceQueries: ['Dọn dẹp mộ', 'Thắp hương'],
      }),
      userMessage: 'Đặt giúp mình dịch vụ dọn dẹp mộ và thắp hương.',
    });
    expect(started?.assistantMessage).toContain('dịch vụ 1/2');
    expect(started?.pendingAction).toMatchObject({
      stage: 'collecting',
      activeServiceItemIndex: 0,
    });
    expect(cemeteryServices.createOrder).not.toHaveBeenCalled();

    const firstDate = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        requestedDate: '2099-08-10',
      }),
      userMessage: 'Dịch vụ này làm ngày 10/08/2099.',
      pendingAction: started?.pendingAction,
    });
    expect(firstDate?.pendingAction).toMatchObject({
      stage: 'awaiting_confirmation',
      activeServiceItemIndex: 0,
    });

    const firstConfirmed = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      userMessage: 'Mình xác nhận ngày này.',
      pendingAction: firstDate?.pendingAction,
    });
    expect(firstConfirmed?.assistantMessage).toContain('Thắp hương');
    expect(firstConfirmed?.pendingAction).toMatchObject({
      stage: 'collecting',
      activeServiceItemIndex: 1,
    });
    expect(cemeteryServices.createOrder).not.toHaveBeenCalled();

    const secondDate = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_service_order', 'service_booking', {
        requestedDate: '2099-08-11',
      }),
      userMessage: 'Thắp hương vào ngày 11/08/2099.',
      pendingAction: firstConfirmed?.pendingAction,
    });
    cemeteryServices.createOrder
      .mockResolvedValueOnce({ id: 101 })
      .mockResolvedValueOnce({ id: 102 });

    const completed = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      userMessage: 'Mình xác nhận ngày của dịch vụ này.',
      pendingAction: secondDate?.pendingAction,
    });

    expect(cemeteryServices.createOrder).toHaveBeenCalledTimes(2);
    expect(cemeteryServices.createOrder).toHaveBeenNthCalledWith(
      1,
      7,
      expect.objectContaining({ requestedDate: '2099-08-10' }),
    );
    expect(cemeteryServices.createOrder).toHaveBeenNthCalledWith(
      2,
      7,
      expect.objectContaining({ requestedDate: '2099-08-11' }),
    );
    expect(completed?.uiDirective).toMatchObject({
      type: 'SHOW_INLINE_SERVICE_PAYMENT',
      orderId: 101,
      orderIds: [101, 102],
      paymentStatus: 'unpaid',
    });
  });

  it('asks the customer to choose when several service orders can match cancellation', async () => {
    const { service, cemeteryServices } = createService();
    cemeteryServices.myOrders.mockResolvedValue([
      {
        id: 52,
        status: 'submitted',
        paymentStatus: 'unpaid',
        serviceName: 'Thay hoa tươi',
        plotCode: 'A-01-002',
        requestedDate: '2099-08-12',
        createdAt: '2099-08-02T10:00:00Z',
      },
      {
        id: 51,
        status: 'submitted',
        paymentStatus: 'unpaid',
        serviceName: 'Thắp hương',
        plotCode: 'A-01-001',
        requestedDate: '2099-08-11',
        createdAt: '2099-08-01T10:00:00Z',
      },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('cancel_service_order', 'service_booking'),
      userMessage: 'Hủy một dịch vụ giúp mình.',
    });

    expect(cemeteryServices.cancelByCustomer).not.toHaveBeenCalled();
    expect(result?.assistantMessage).toContain('chọn đúng một đơn');
    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      operation: 'cancel',
      stage: 'collecting',
      candidateOrderIds: [52, 51],
    });
    expect(result?.quickReplies).toHaveLength(2);
  });

  it('resolves "đơn vừa đặt" to the newest active service order', async () => {
    const { service, cemeteryServices } = createService();
    cemeteryServices.myOrders.mockResolvedValue([
      {
        id: 62,
        status: 'submitted',
        paymentStatus: 'unpaid',
        serviceName: 'Dọn dẹp mộ',
        plotCode: 'A-01-002',
        createdAt: '2099-08-03T10:00:00Z',
      },
      {
        id: 61,
        status: 'submitted',
        paymentStatus: 'unpaid',
        serviceName: 'Thắp hương',
        plotCode: 'A-01-001',
        createdAt: '2099-08-01T10:00:00Z',
      },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('cancel_service_order', 'service_booking'),
      userMessage: 'Hủy đơn dịch vụ vừa đặt giúp mình.',
    });

    expect(result?.pendingAction).toMatchObject({
      operation: 'cancel',
      stage: 'awaiting_confirmation',
      orderId: 62,
      serviceName: 'Dọn dẹp mộ',
    });
    expect(result?.assistantMessage).toContain('#62');
    expect(cemeteryServices.cancelByCustomer).not.toHaveBeenCalled();
  });

  it('cancels only the explicitly confirmed service order', async () => {
    const { service, cemeteryServices } = createService();
    cemeteryServices.cancelByCustomer.mockResolvedValue({
      id: 72,
      status: 'cancelled',
      serviceName: 'Thắp hương',
      plotCode: 'A-01-001',
    });
    const pending: AgentPendingAction = {
      kind: 'service_order',
      operation: 'cancel',
      stage: 'awaiting_confirmation',
      orderId: 72,
      serviceName: 'Thắp hương',
      plotCode: 'A-01-001',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      userMessage: 'Mình xác nhận hủy đơn #72.',
      pendingAction: pending,
    });

    expect(cemeteryServices.cancelByCustomer).toHaveBeenCalledWith(72, 7);
    expect(result?.assistantMessage).toContain('Các đơn dịch vụ khác');
    expect(result?.assistantMessage).toContain('#72');
  });

  it('does not auto-cancel a service order whose payment was reported', async () => {
    const { service, cemeteryServices } = createService();
    cemeteryServices.myOrders.mockResolvedValue([
      {
        id: 82,
        status: 'confirmed',
        paymentStatus: 'awaiting_confirmation',
        serviceName: 'Chăm sóc mộ định kỳ',
        plotCode: 'A-01-002',
        createdAt: '2099-08-03T10:00:00Z',
      },
    ]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('cancel_service_order', 'service_booking', {
        serviceOrderId: 82,
      }),
      userMessage: 'Hủy đơn #82.',
    });

    expect(result?.assistantMessage).toContain('đã ghi nhận thanh toán');
    expect(result?.pendingAction).toBeUndefined();
    expect(cemeteryServices.cancelByCustomer).not.toHaveBeenCalled();
  });

  it('does not create a service order when the confirmed draft has no date', async () => {
    const { service, cemeteryServices } = createService();
    const pending: AgentPendingAction = {
      kind: 'service_order',
      stage: 'awaiting_confirmation',
      serviceTypeId: 3,
      serviceName: 'Dọn dẹp mộ',
      plotId: 10,
      plotCode: 'A-01-001',
      quotedPrice: 200_000,
      serviceUnit: 'lần',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'service_booking'),
      pendingAction: pending,
    });

    expect(cemeteryServices.createOrder).not.toHaveBeenCalled();
    expect(result?.pendingAction).toMatchObject({
      kind: 'service_order',
      stage: 'collecting',
    });
    expect(result?.pendingAction?.requestedDate).toBeUndefined();
    expect(result?.assistantMessage).toContain(
      'thiếu ngày bạn muốn thực hiện dịch vụ',
    );
    expect(result?.uiDirective).toBeUndefined();
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

  it('requires an approved plot and explicit customer selection before opening the appointment calendar', async () => {
    const { service, schedule, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
      { plotId: 11, plotCode: 'B-01-002', zoneName: 'Khu B' },
    ]);

    const selectionTurn = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking', {
        appointmentDate: '2099-08-20',
        appointmentStartTime: '09:00',
        appointmentTopic: 'Trao đổi hồ sơ lô A-01-001',
        selectedPlotCode: 'A-01-001',
      }),
      userMessage:
        'Mình muốn đặt lịch cho lô A-01-001 ngày 20/08/2099 lúc 09:00.',
    });

    expect(schedule.bookAppointment).not.toHaveBeenCalled();
    expect(selectionTurn?.uiDirective).toBeUndefined();
    expect(selectionTurn?.assistantMessage).toContain('không tự chọn thay bạn');
    expect(selectionTurn?.quickReplies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Chọn lô A-01-001' }),
        expect.objectContaining({ label: 'Chọn lô B-01-002' }),
      ]),
    );

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking', {
        appointmentDate: '2099-08-20',
        appointmentStartTime: '09:00',
      }),
      userMessage: 'Mình chọn lô A-01-001.',
      pendingAction: selectionTurn?.pendingAction,
    });

    expect(result).toMatchObject({
      intent: 'appointment_booking',
      uiDirective: {
        type: 'OPEN_APPOINTMENT_CALENDAR',
        mode: 'review',
        appointmentDate: '2099-08-20',
        startTime: '09:00',
        endTime: '10:00',
        plotCode: 'A-01-001',
      },
      pendingAction: {
        kind: 'appointment',
        stage: 'awaiting_confirmation',
        startTime: '09:00',
        endTime: '10:00',
      },
    });
    expect(result?.assistantMessage).toContain('A-01-001');
  });

  it('does not open appointment booking when the customer has no approved plot request', async () => {
    const { service, schedule, database } = createService();
    database.query.mockResolvedValue([]);

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking'),
      userMessage: 'Mình muốn đặt lịch với ban quản lý.',
    });

    expect(schedule.bookAppointment).not.toHaveBeenCalled();
    expect(result?.uiDirective).toBeUndefined();
    expect(result?.pendingAction).toBeUndefined();
    expect(result?.assistantMessage).toContain('chưa có yêu cầu lô nào');
  });

  it('books an appointment only after explicit confirmation', async () => {
    const { service, schedule, database } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
    ]);
    schedule.bookAppointment.mockResolvedValue({ id: 71 });
    const pending: AgentPendingAction = {
      kind: 'appointment',
      stage: 'awaiting_confirmation',
      appointmentDate: '2099-08-20',
      startTime: '09:00',
      endTime: '10:00',
      topic: 'Lý do khác do planner đưa vào',
      selectedPlotCode: 'A-01-001',
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'appointment_booking'),
      pendingAction: pending,
    });

    expect(schedule.bookAppointment).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        appointmentDate: '2099-08-20',
        startTime: '09:00',
        endTime: '10:00',
        note: 'Hẹn xem lô đất A-01-001',
      }),
    );
    expect(result?.uiDirective).toEqual({
      type: 'OPEN_APPOINTMENT_CALENDAR',
      mode: 'summary',
      appointmentId: 71,
      appointmentDate: '2099-08-20',
      startTime: '09:00',
      endTime: '10:00',
      topic: 'Hẹn xem lô đất A-01-001',
      plotCode: 'A-01-001',
    });
  });

  it('collects and confirms a separate appointment for every explicitly selected approved plot', async () => {
    const { service, database, schedule } = createService();
    database.query.mockResolvedValue([
      { plotId: 10, plotCode: 'A-01-001', zoneName: 'Khu A' },
      { plotId: 11, plotCode: 'A-01-002', zoneName: 'Khu A' },
    ]);
    schedule.bookAppointment
      .mockResolvedValueOnce({ id: 201 })
      .mockResolvedValueOnce({ id: 202 });

    const choosePlots = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking'),
      userMessage: 'Mình muốn đặt lịch.',
    });
    const first = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking'),
      userMessage: 'Mình muốn xem lô A-01-001 và A-01-002.',
      pendingAction: choosePlots?.pendingAction,
    });
    expect(first?.assistantMessage).toContain('lô 1/2');
    expect(schedule.bookAppointment).not.toHaveBeenCalled();

    const firstDate = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking', {
        appointmentDate: '2099-08-20',
        appointmentStartTime: '09:00',
      }),
      userMessage: 'Lô đầu ngày 20/08/2099 lúc 09:00.',
      pendingAction: first?.pendingAction,
    });
    const firstConfirmed = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'appointment_booking'),
      userMessage: 'Mình xác nhận lịch lô đầu.',
      pendingAction: firstDate?.pendingAction,
    });
    expect(firstConfirmed?.assistantMessage).toContain('A-01-002');
    expect(schedule.bookAppointment).not.toHaveBeenCalled();

    const secondDate = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking', {
        appointmentDate: '2099-08-21',
        appointmentStartTime: '14:00',
      }),
      userMessage: 'Lô thứ hai ngày 21/08/2099 lúc 14:00.',
      pendingAction: firstConfirmed?.pendingAction,
    });
    const completed = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'appointment_booking'),
      userMessage: 'Mình xác nhận lịch lô thứ hai.',
      pendingAction: secondDate?.pendingAction,
    });

    expect(schedule.bookAppointment).toHaveBeenCalledTimes(2);
    expect(schedule.bookAppointment).toHaveBeenNthCalledWith(
      1,
      7,
      expect.objectContaining({
        appointmentDate: '2099-08-20',
        note: 'Hẹn xem lô đất A-01-001',
      }),
    );
    expect(schedule.bookAppointment).toHaveBeenNthCalledWith(
      2,
      7,
      expect.objectContaining({
        appointmentDate: '2099-08-21',
        note: 'Hẹn xem lô đất A-01-002',
      }),
    );
    expect(completed?.assistantMessage).toContain('2 yêu cầu lịch hẹn');
  });

  it('drafts a recurring memorial reminder with the account email and waits for confirmation', async () => {
    const { service, database, reminders } = createService();
    database.queryOne.mockResolvedValue({
      fullName: 'An Võ',
      phone: '0900000000',
      email: 'an@example.com',
    });

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_memorial_reminder', 'memorial_reminder', {
        reminderTitle: 'Tưởng niệm ông nội',
        reminderDescription:
          'Kính gửi gia đình, xin nhắc về ngày tưởng niệm sắp tới.',
        reminderDate: '2099-08-20',
        reminderRecurring: true,
        reminderCalendarType: 'solar',
        reminderNotifyDaysBefore: 3,
      }),
    });

    expect(reminders.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      intent: 'memorial_reminder',
      uiDirective: { type: 'OPEN_REMINDER_CALENDAR' },
      pendingAction: {
        kind: 'memorial_reminder',
        stage: 'awaiting_confirmation',
        remindMonth: 8,
        remindDay: 20,
        isRecurring: true,
        notifyEmails: ['an@example.com'],
      },
    });
  });

  it('creates a memorial reminder only after explicit confirmation', async () => {
    const { service, reminders } = createService();
    reminders.create.mockResolvedValue({ id: 72 });
    const pending: AgentPendingAction = {
      kind: 'memorial_reminder',
      stage: 'awaiting_confirmation',
      title: 'Tưởng niệm ông nội',
      description: 'Nội dung email tưởng niệm đã được gia đình xem lại.',
      remindMonth: 8,
      remindDay: 20,
      isRecurring: true,
      calendarType: 'solar',
      notifyDaysBefore: 3,
      notifyEmails: ['an@example.com'],
    };

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('confirm_pending_action', 'memorial_reminder'),
      pendingAction: pending,
    });

    expect(reminders.create).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        title: 'Tưởng niệm ông nội',
        reminderType: 'memorial',
        remindMonth: 8,
        remindDay: 20,
        notifyEmail: true,
        notifyEmails: ['an@example.com'],
      }),
    );
    expect(result?.uiDirective).toEqual({
      type: 'OPEN_REMINDER_CALENDAR',
      reminderId: 72,
      reminderDate: undefined,
    });
  });
});
