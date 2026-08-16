import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { TransfersController } from './transfers.controller';

describe('TransfersController guards', () => {
  it('protects controller with JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', TransfersController);
    expect(guards).toContain(JwtAuthGuard);
  });

  it('protects admin routes with admin role', () => {
    const adminHandlers = [
      TransfersController.prototype.adminListTransferRequests,
      TransfersController.prototype.adminTransferRequestDetail,
      TransfersController.prototype.approveTransferRequest,
      TransfersController.prototype.rejectTransferRequest,
      TransfersController.prototype.createTransferAppointment,
      TransfersController.prototype.activateTransferOwnership,
      TransfersController.prototype.downloadRequestDocument,
      TransfersController.prototype.search,
      TransfersController.prototype.list,
      TransfersController.prototype.ownership,
      TransfersController.prototype.detail,
      TransfersController.prototype.transfer,
      TransfersController.prototype.download,
    ];
    for (const handler of adminHandlers) {
      const roles = Reflect.getMetadata(ROLES_KEY, handler);
      expect(roles).toEqual(['admin']);
    }
  });
});
