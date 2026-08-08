import { NotFoundException } from '@nestjs/common';
import { DeceasedAccessService } from './deceased-access.service';

describe('DeceasedAccessService', () => {
  it('allows admins without ownership', async () => {
    const service = new DeceasedAccessService({} as never);
    await expect(
      service.assertPlotOwner({ id: 1, role: 'admin' }, 9),
    ).resolves.toBeUndefined();
  });
  it('does not turn membership into permission', async () => {
    const database = {
      queryOne: jest
        .fn()
        .mockResolvedValueOnce({ plot_id: 2 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const service = new DeceasedAccessService(database as never);
    await expect(
      service.assert(
        { id: 5, role: 'customer' },
        'deceased_profile',
        7,
        'view_profile',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('requires the exact permission action', async () => {
    const database = {
      queryOne: jest
        .fn()
        .mockResolvedValueOnce({ plot_id: 2 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const service = new DeceasedAccessService(database as never);
    expect(
      await service.can(
        { id: 5, role: 'customer' },
        'deceased_profile',
        7,
        'order_service',
      ),
    ).toBe(false);
    expect(database.queryOne).toHaveBeenLastCalledWith(
      expect.stringContaining('rp.action=$4'),
      [5, 'deceased_profile', 7, 'order_service'],
    );
  });
});
