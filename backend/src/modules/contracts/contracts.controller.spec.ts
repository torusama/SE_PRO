import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ContractsController } from './contracts.controller';

describe('ContractsController admin guards', () => {
  const controller = new ContractsController({} as never);

  it.each([
    'adminList',
    'adminOne',
    'fromReservation',
    'updateStatus',
    'addPayment',
    'updateInheritance',
    'signAdmin',
    'uploadAdminPdf',
    'downloadAdminPdf',
  ] as const)('%s requires admin role', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual([
      'admin',
    ]);
  });
});
