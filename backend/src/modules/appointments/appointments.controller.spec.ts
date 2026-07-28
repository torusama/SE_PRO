import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AppointmentsController } from './appointments.controller';

describe('AppointmentsController', () => {
  const service = {
    create: jest.fn(),
    my: jest.fn(),
    adminList: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
  };
  const controller = new AppointmentsController(service as never);
  const reflector = new Reflector();

  it('wraps admin create response', async () => {
    service.create.mockResolvedValue({ id: 1 });

    await expect(
      controller.create(
        { id: 9 },
        {
          reservationRequestId: 10,
          scheduledAt: '2026-07-15T09:00:00+07:00',
          location: 'Office',
        },
        {} as never,
      ),
    ).resolves.toEqual({
      success: true,
      message: 'Appointment created',
      data: { id: 1 },
    });
  });

  it('marks admin create endpoint as admin-only', () => {
    expect(reflector.get(ROLES_KEY, controller.create)).toEqual(['admin']);
  });
});
