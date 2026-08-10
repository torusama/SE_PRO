import { AppointmentReminderScheduler } from './appointment-reminder.scheduler';

describe('AppointmentReminderScheduler', () => {
  it('sends tomorrow confirmed appointments with AI-first copy and records delivery', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            source: 'schedule',
            id: 12,
            customerId: 7,
            customerName: 'An Võ',
            email: 'an@example.com',
            appointmentDate: '2099-08-11',
            startTime: '09:00',
            endTime: '10:00',
            location: null,
            topic: 'Tư vấn lô A-01-001',
          },
        ])
        .mockResolvedValueOnce([]),
      queryOne: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(async (callback: (tx: typeof client) => Promise<unknown>) =>
        callback(client),
      ),
    };
    const emailService = {
      sendAppointmentReminderEmail: jest.fn().mockResolvedValue(true),
    };
    const drafts = {
      generate: jest.fn().mockResolvedValue({
        content: 'Nội dung do AI soạn.',
        aiUsed: true,
      }),
    };

    const scheduler = new AppointmentReminderScheduler(
      database as never,
      emailService as never,
      drafts as never,
    );

    await scheduler.sendTomorrowAppointmentReminders();

    expect(drafts.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentDate: '2099-08-11',
        startTime: '09:00',
        fallback: expect.stringContaining('ngày mai'),
      }),
    );
    expect(emailService.sendAppointmentReminderEmail).toHaveBeenCalledWith(
      'an@example.com',
      expect.objectContaining({ message: 'Nội dung do AI soạn.' }),
    );
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('appointment_reminder_deliveries'),
      expect.arrayContaining(['schedule', 12, 7, '2099-08-11', 'an@example.com', true]),
    );
  });

  it('does not mark a reminder delivered when Gmail is not configured', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            source: 'schedule',
            id: 12,
            customerId: 7,
            customerName: 'An Võ',
            email: 'an@example.com',
            appointmentDate: '2099-08-11',
            startTime: '09:00',
            endTime: '10:00',
            location: null,
            topic: null,
          },
        ])
        .mockResolvedValueOnce([]),
      queryOne: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(),
    };
    const emailService = {
      sendAppointmentReminderEmail: jest.fn().mockResolvedValue(false),
    };
    const drafts = {
      generate: jest.fn().mockResolvedValue({
        content: 'Fallback hoặc AI.',
        aiUsed: false,
      }),
    };

    const scheduler = new AppointmentReminderScheduler(
      database as never,
      emailService as never,
      drafts as never,
    );

    await scheduler.sendTomorrowAppointmentReminders();

    expect(database.transaction).not.toHaveBeenCalled();
  });
});
