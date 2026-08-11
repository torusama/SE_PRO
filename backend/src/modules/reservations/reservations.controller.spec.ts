import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ReservationsController } from './reservations.controller';

describe('ReservationsController admin contract', () => {
  const service = {
    adminList: jest.fn().mockResolvedValue({ items: [] }),
    adminOne: jest.fn().mockResolvedValue({ id: 1 }),
    adminCancellationList: jest.fn().mockResolvedValue({ items: [] }),
    adminCancellationOne: jest.fn().mockResolvedValue({ id: 1 }),
    approveCancellation: jest.fn().mockResolvedValue({ id: 1, status: 'approved' }),
    rejectCancellation: jest.fn().mockResolvedValue({ id: 1, status: 'rejected' }),
    approve: jest.fn().mockResolvedValue({ id: 1, status: 'approved' }),
    reject: jest.fn().mockResolvedValue({ id: 1, status: 'rejected' }),
  };
  const controller = new ReservationsController(service as never);

  it.each([
    'adminList',
    'adminOne',
    'adminCancellationList',
    'adminCancellationOne',
    'approveCancellation',
    'rejectCancellation',
    'approve',
    'reject',
  ] as const)(
    '%s requires the admin role',
    (method) => {
      expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual([
        'admin',
      ]);
    },
  );

  it('binds list/detail/review routes to the service contract', async () => {
    await controller.adminList({ page: 1, pageSize: 20 } as never);
    await controller.adminOne('1');
    await controller.adminCancellationList({ page: 1, pageSize: 20 } as never);
    await controller.adminCancellationOne('1');
    await controller.approveCancellation({ id: 9 }, '1', { adminNote: 'ok' }, { adminId: 9, ipAddress: null, userAgent: null });
    await controller.rejectCancellation({ id: 9 }, '1', { adminNote: 'no' }, { adminId: 9, ipAddress: null, userAgent: null });
    await controller.approve(
      { id: 9 },
      '1',
      { adminNote: 'ok' },
      { adminId: 9, ipAddress: null, userAgent: null },
    );
    await controller.reject(
      { id: 9 },
      '1',
      { adminNote: 'no' },
      { adminId: 9, ipAddress: null, userAgent: null },
    );
    expect(service.adminList).toHaveBeenCalled();
    expect(service.adminOne).toHaveBeenCalledWith(1);
    expect(service.approve).toHaveBeenCalled();
    expect(service.reject).toHaveBeenCalled();
    expect(service.approveCancellation).toHaveBeenCalled();
    expect(service.rejectCancellation).toHaveBeenCalled();
  });
});
