import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService admin operations', () => {
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
    const database = {
      transaction: jest.fn(async (callback: any) => callback(client)),
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
