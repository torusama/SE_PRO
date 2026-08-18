import { BadRequestException } from '@nestjs/common';
import { DeceasedService } from './deceased.service';

describe('DeceasedService capacity', () => {
  it('uses a capacity of one when the plot has not been configured', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE'))
          return Promise.resolve({
            rows: [{ deceased_profile_capacity: null }],
          });
        if (sql.includes('COUNT(*)'))
          return Promise.resolve({ rows: [{ count: 0 }] });
        if (sql.includes('INSERT INTO deceased_profiles'))
          return Promise.resolve({ rows: [{ id: 11 }] });
        return Promise.resolve({ rows: [] });
      }),
    };
    const database = {
      transaction: jest.fn((cb: (value: typeof client) => unknown) =>
        Promise.resolve(cb(client)),
      ),
    };
    const access = { assertPlotOwner: jest.fn(), isAdmin: jest.fn() };
    const service = new DeceasedService(database as never, access as never);
    await expect(
      service.create({ id: 1, role: 'customer' }, { plotId: 2, fullName: 'A' }),
    ).resolves.toEqual({ id: 11 });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [2],
    );
  });
  it('validates date order before mutation', async () => {
    const database = { transaction: jest.fn() };
    const service = new DeceasedService(database as never, {} as never);
    await expect(
      service.create(
        { id: 1, role: 'customer' },
        {
          plotId: 2,
          fullName: 'A',
          dateOfBirth: '2020-01-02',
          dateOfDeath: '2020-01-01',
        },
      ),
    ).rejects.toThrow('Ngày mất');
    expect(database.transaction).not.toHaveBeenCalled();
  });
  it('rejects future dates before mutation', async () => {
    const database = { transaction: jest.fn() };
    const service = new DeceasedService(database as never, {} as never);
    await expect(
      service.create(
        { id: 1, role: 'customer' },
        { plotId: 2, fullName: 'A', burialDate: '2999-01-01' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
