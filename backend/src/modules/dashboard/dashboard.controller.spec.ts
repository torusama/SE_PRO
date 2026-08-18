import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  const service = {
    summary: jest.fn(),
    plots: jest.fn(),
    revenue: jest.fn(),
    services: jest.fn(),
  };
  const controller = new DashboardController(service as never);

  it('is admin-only', () => {
    expect(new Reflector().get(ROLES_KEY, DashboardController)).toEqual([
      'admin',
    ]);
  });

  it('passes the validated period to revenue service', async () => {
    service.revenue.mockResolvedValue([]);
    await controller.revenue({ period: 'year' });
    expect(service.revenue).toHaveBeenCalledWith('year');
  });
});
