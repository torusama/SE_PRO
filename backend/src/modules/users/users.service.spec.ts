import { UsersService } from './users.service';

describe('UsersService admin operations', () => {
  it('returns paginated filtered users', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 2, email: 'a@b.vn' }]),
    };
    const service = new UsersService(
      database as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.findAll({
        page: 1,
        pageSize: 20,
        offset: 0,
        search: 'a',
        role: 'customer',
        sortOrder: 'desc',
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 2 }] });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT'),
      expect.arrayContaining(['%a%', 'customer', 20, 0]),
    );
  });

  it('masks identity numbers in admin detail', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({
        id: 2,
        idCardNumber: '012345678901',
        fullName: 'Khách hàng',
      }),
    };
    const service = new UsersService(
      database as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.findById(2)).resolves.toMatchObject({
      idCardNumber: expect.stringContaining('8901'),
    });
    const detail = await service.findById(2);
    expect(detail.idCardNumber).not.toContain('01234567');
  });

  it('updates status and persists audit in the same transaction', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 2, isActive: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, isActive: false }] }),
    };
    const database = {
      transaction: jest.fn(async (callback: any) => callback(client)),
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 1 }) };
    const service = new UsersService(
      database as never,
      {} as never,
      {} as never,
      audit as never,
    );
    await service.updateStatus(2, false, {
      adminId: 1,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'user.locked', entityId: 2 }),
    );
  });
});
