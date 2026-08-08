import { ConflictException } from '@nestjs/common';
import { ResourcePermissionService } from './resource-permission.service';
describe('ResourcePermissionService', () => {
  it('does not allow view_profile to imply ordering', async () => {
    const client = {
      query: jest.fn((sql: string) =>
        sql.includes('family_memberships')
          ? Promise.resolve({ rows: [{ membership_id: 1 }] })
          : sql.includes('SELECT plot_id')
            ? Promise.resolve({ rows: [{ plot_id: 2 }] })
            : Promise.resolve({ rows: [] }),
      ),
    };
    const database = {
      transaction: jest.fn((cb: (value: typeof client) => unknown) =>
        Promise.resolve(cb(client)),
      ),
    };
    const access = {
      assertPlotOwner: jest.fn(),
      isAdmin: jest.fn(() => false),
    };
    const service = new ResourcePermissionService(
      database as never,
      access as never,
    );
    await expect(
      service.grant({ id: 1, role: 'customer' }, 1, {
        memberUserId: 2,
        resourceType: 'deceased_profile',
        resourceId: 3,
        action: 'view_plot',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
