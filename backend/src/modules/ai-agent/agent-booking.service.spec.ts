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
    expect(result?.uiDirective).toEqual({
      type: 'SHOW_INLINE_SERVICE_PAYMENT',
      serviceTypeId: 3,
      orderId: 45,
      amount: 200_000,
      paymentStatus: 'unpaid',
    });
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

  it('prepares an appointment and opens the appointment calendar before confirmation', async () => {
    const { service, schedule } = createService();

    const result = await service.handleTurn({
      conversationId: 1,
      userId: 7,
      plan: plan('prepare_appointment', 'appointment_booking', {
        appointmentDate: '2099-08-20',
        appointmentStartTime: '09:00',
        appointmentTopic: 'Tham quan lô A-01-001',
        selectedPlotCode: 'A-01-001',
      }),
    });

    expect(schedule.bookAppointment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      intent: 'appointment_booking',
      uiDirective: {
        type: 'OPEN_APPOINTMENT_CALENDAR',
        mode: 'review',
        appointmentDate: '2099-08-20',
        startTime: '09:00',
        endTime: '10:00',
        topic: 'Tham quan lô A-01-001',
      },
      pendingAction: {
        kind: 'appointment',
        stage: 'awaiting_confirmation',
        startTime: '09:00',
        endTime: '10:00',
      },
    });
    expect(result?.assistantMessage.match(/A-01-001/g)).toHaveLength(1);
  });

  it('books an appointment only after explicit confirmation', async () => {
    const { service, schedule } = createService();
    schedule.bookAppointment.mockResolvedValue({ id: 71 });
    const pending: AgentPendingAction = {
      kind: 'appointment',
      stage: 'awaiting_confirmation',
      appointmentDate: '2099-08-20',
      startTime: '09:00',
      endTime: '10:00',
      topic: 'Tham quan lô A-01-001',
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
      }),
    );
    expect(result?.uiDirective).toEqual({
      type: 'OPEN_APPOINTMENT_CALENDAR',
      mode: 'summary',
      appointmentId: 71,
      appointmentDate: '2099-08-20',
      startTime: '09:00',
      endTime: '10:00',
      topic: 'Tham quan lô A-01-001',
    });
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
        reminderDescription: 'Kính gửi gia đình, xin nhắc về ngày tưởng niệm sắp tới.',
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
