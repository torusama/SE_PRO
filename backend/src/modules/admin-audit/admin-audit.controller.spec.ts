import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AdminAuditController } from './admin-audit.controller';

describe('AdminAuditController', () => {
  it('is restricted to administrators', () => {
    const roles = new Reflector().get(ROLES_KEY, AdminAuditController);
    expect(roles).toEqual(['admin']);
  });

  it('wraps paginated data', async () => {
    const data = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    const controller = new AdminAuditController({
      list: jest.fn().mockResolvedValue(data),
    } as never);
    await expect(controller.list({} as never)).resolves.toEqual({
      success: true,
      message: 'Đã tải nhật ký hoạt động',
      data,
    });
  });
});
