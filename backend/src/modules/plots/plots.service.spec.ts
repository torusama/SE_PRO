import { BadRequestException } from '@nestjs/common';
import { PlotsService } from './plots.service';

describe('PlotsService admin operations', () => {
  it('keeps public plot detail free of owner and deceased fields', async () => {
    const database = { queryOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const service = new PlotsService(database as never);
    await service.findOne(1);
    const sql = database.queryOne.mock.calls[0][0] as string;
    expect(sql).not.toContain('owner_name');
    expect(sql).not.toContain('owner_phone');
    expect(sql).not.toContain('deceased_name');
  });
  it('returns paginated plot records', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 1, plotCode: 'A-01-001' }]),
    };
    const service = new PlotsService(database as never);
    await expect(
      service.adminFindAll({
        page: 1,
        pageSize: 20,
        offset: 0,
        includeDeleted: false,
        sortOrder: 'desc',
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 1 }] });
  });

  it('maps zone deletion to inactive state', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ id: 1, isActive: false }),
    };
    const service = new PlotsService(database as never);
    await service.deactivateZone(1);
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('is_active = COALESCE'),
      expect.arrayContaining([1, false]),
    );
  });

  it('creates, updates, deactivates and restores zones', async () => {
    const database = {
      queryOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 1, code: 'D', isActive: true })
        .mockResolvedValueOnce({ id: 1, code: 'D', isActive: true })
        .mockResolvedValueOnce({ id: 1, code: 'D', isActive: false })
        .mockResolvedValueOnce({ id: 1, code: 'D', isActive: true }),
    };
    const service = new PlotsService(database as never);
    await service.createZone({ code: 'D', name: 'Khu D' });
    await service.updateZone(1, { name: 'Khu D mới' });
    await service.deactivateZone(1);
    await service.restoreZone(1);
    expect(database.queryOne).toHaveBeenCalledTimes(4);
  });

  it('maps duplicate zone codes to a validation error', async () => {
    const database = {
      queryOne: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new PlotsService(database as never);
    await expect(
      service.createZone({ code: 'A', name: 'Trùng' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks direct transitions away from locked state', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ id: 1, status: 'locked' }),
    };
    const service = new PlotsService(database as never);
    await expect(service.updateStatus(1, 'available')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('atomically locks, unlocks, deletes and restores with audit', async () => {
    const beforeRows = [
      { id: 1, plotCode: 'A-01', status: 'available', isDeleted: false },
      {
        id: 1,
        plotCode: 'A-01',
        status: 'locked',
        previousStatus: 'available',
        isDeleted: false,
      },
      { id: 1, plotCode: 'A-01', status: 'available', isDeleted: false },
      { id: 1, plotCode: 'A-01', status: 'available', isDeleted: true },
    ];
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE'))
          return Promise.resolve({ rows: [beforeRows.shift()] });
        if (sql.includes("status='locked'"))
          return Promise.resolve({ rows: [{ id: 1, status: 'locked' }] });
        if (sql.includes('previous_status=NULL'))
          return Promise.resolve({ rows: [{ id: 1, status: 'available' }] });
        if (sql.includes('is_deleted=TRUE'))
          return Promise.resolve({ rows: [{ id: 1 }] });
        if (sql.includes('is_deleted=FALSE'))
          return Promise.resolve({ rows: [{ id: 1, status: 'available' }] });
        return Promise.resolve({ rows: [] });
      }),
    };
    const database = {
      transaction: jest.fn((callback: (value: typeof client) => unknown) =>
        Promise.resolve(callback(client)),
      ),
    };
    const audit = { record: jest.fn() };
    const service = new PlotsService(database as never, audit as never);
    const context = { adminId: 9, ipAddress: '127.0.0.1', userAgent: 'jest' };
    await service.adminLock(1, 9, 'Bảo trì', context);
    await service.adminUnlock(1, context);
    await service.adminRemove(1, context);
    await service.adminRestore(1, context);
    expect(audit.record).toHaveBeenCalledTimes(4);
    expect(database.transaction).toHaveBeenCalledTimes(4);
  });

  it('rejects invalid admin transitions before updating or auditing', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 1, status: 'sold', isDeleted: false }],
      }),
    };
    const database = {
      transaction: jest.fn((callback: (value: typeof client) => unknown) =>
        Promise.resolve(callback(client)),
      ),
    };
    const audit = { record: jest.fn() };
    const service = new PlotsService(database as never, audit as never);
    await expect(
      service.adminStatus(1, 'available', {
        adminId: 9,
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
