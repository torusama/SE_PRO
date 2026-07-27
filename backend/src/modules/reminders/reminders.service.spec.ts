import { RemindersService } from './reminders.service';

describe('RemindersService admin operations', () => {
  it('returns paginated filtered reminders', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '0' }),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new RemindersService(database as never, {} as never, {} as never);
    await expect(
      service.allForAdmin({
        page: 1,
        pageSize: 20,
        offset: 0,
        search: 'khách',
        type: 'memorial',
      } as never),
    ).resolves.toMatchObject({ items: [], total: 0, page: 1 });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      ['memorial', '%khách%', 20, 0],
    );
  });

  it('sends a supported in-app notify-now reminder', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({
        id: 5,
        userId: 2,
        title: 'Ngày giỗ',
        reminderType: 'memorial',
        isRecurring: false,
        specificDate: '2026-08-01',
        isActive: true,
        notifyEmail: false,
        notifyEmails: [],
        plotCode: 'A-01',
      }),
      query: jest.fn(),
    };
    const notifications = { createInApp: jest.fn() };
    const service = new RemindersService(
      database as never,
      notifications as never,
      {} as never,
    );
    await expect(service.notifyNow(5)).resolves.toEqual({ id: 5, notified: true });
    expect(notifications.createInApp).toHaveBeenCalledWith(
      2,
      'memorial_reminder',
      expect.any(String),
      expect.any(String),
      'reminder',
      5,
    );
  });
});
