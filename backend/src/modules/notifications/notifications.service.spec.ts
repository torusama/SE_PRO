import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService admin operations', () => {
  it('marks a user notification unread within the owner scope', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ id: 7, isRead: false }),
    };
    const service = new NotificationsService(database as never);

    await expect(service.markUnread(3, 7)).resolves.toEqual({
      id: 7,
      isRead: false,
    });
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('user_id = $2'),
      [7, 3],
    );
  });

  it('clears only the current user notifications', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValue([{ notification_id: 4 }, { notification_id: 5 }]),
    };
    const service = new NotificationsService(database as never);

    await expect(service.deleteAll(3)).resolves.toEqual({ deleted: 2 });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      [3],
    );
  });

  it('paginates admin notifications', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    const service = new NotificationsService(database as never);
    await expect(
      service.adminList({
        page: 1,
        pageSize: 20,
        offset: 0,
        isRead: false,
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 1 }] });
  });

  it('rejects unsupported delivery channels', async () => {
    const service = new NotificationsService({} as never);
    await expect(
      service.broadcast(
        {
          audience: 'all_customers',
          title: 'Thông báo',
          content: 'Nội dung',
          channel: 'sms',
        } as never,
        { adminId: 1, ipAddress: null, userAgent: null },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('inserts broadcast recipients and audit in one transaction', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValue({ rows: [{ notification_id: 1 }], rowCount: 1 }),
    };
    type TransactionCallback = (value: typeof client) => Promise<unknown>;
    const database = {
      transaction: jest.fn((callback: TransactionCallback) => callback(client)),
    };
    const audit = { record: jest.fn() };
    const service = new NotificationsService(database as never, audit as never);
    await expect(
      service.broadcast(
        {
          audience: 'all_customers',
          title: 'Thông báo',
          content: 'Nội dung',
          channel: 'in_app',
          type: 'announcement',
        },
        { adminId: 1, ipAddress: '127.0.0.1', userAgent: 'jest' },
      ),
    ).resolves.toMatchObject({ recipientCount: 1 });
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'notification.broadcast' }),
    );
  });
});
