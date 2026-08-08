import { ConflictException } from '@nestjs/common';
import { DeceasedService } from './deceased.service';

describe('DeceasedService capacity', () => {
  it('locks the plot and rejects missing capacity', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE'))
          return Promise.resolve({
            rows: [{ deceased_profile_capacity: null }],
          });
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
    ).rejects.toBeInstanceOf(ConflictException);
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
});
