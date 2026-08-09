import { classifyRealtimeMutation } from './realtime-mutation.interceptor';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RealtimeMutationInterceptor } from './realtime-mutation.interceptor';

describe('classifyRealtimeMutation', () => {
  it('publishes plot changes publicly and dependent admin topics privately', () => {
    expect(
      classifyRealtimeMutation('PATCH', '/api/admin/plots/4/status', 1),
    ).toEqual({
      topics: ['plots', 'dashboard', 'audit'],
      rooms: ['admin'],
    });
  });

  it('invalidates the complete reservation workflow after commit', () => {
    const mutation = classifyRealtimeMutation(
      'PATCH',
      '/api/admin/reservations/12/approve',
      1,
    );
    expect(mutation?.rooms).toEqual(['authenticated']);
    expect(mutation?.topics).toEqual(
      expect.arrayContaining([
        'reservations',
        'plots',
        'contracts',
        'notifications',
      ]),
    );
  });

  it('scopes notification read state to its owner', () => {
    expect(
      classifyRealtimeMutation('PATCH', '/api/notifications/7/read', 33),
    ).toEqual({
      topics: ['notifications'],
      rooms: ['user:33'],
    });
  });

  it('revalidates revoked durable sessions', () => {
    expect(
      classifyRealtimeMutation(
        'DELETE',
        '/api/users/me/sessions/9',
        33,
      ),
    ).toEqual({
      topics: ['sessions'],
      rooms: ['user:33'],
      revalidateUserId: 33,
    });
  });

  it('does not reload forms for OTP metadata mutations or GET requests', () => {
    expect(
      classifyRealtimeMutation(
        'POST',
        '/api/users/me/phone/send-otp',
        33,
      ),
    ).toBeNull();
    expect(
      classifyRealtimeMutation('GET', '/api/admin/contracts', 1),
    ).toBeNull();
  });
});

describe('RealtimeMutationInterceptor', () => {
  function context(role = 'customer') {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          originalUrl: '/api/admin/appointments/9/status',
          user: { id: 1, role },
        }),
      }),
    };
  }

  it('publishes only after a successful handler result', async () => {
    const realtime = {
      publish: jest.fn(),
      disconnectInvalidUserSockets: jest.fn(),
    };
    const interceptor = new RealtimeMutationInterceptor(realtime as never);

    await lastValueFrom(
      interceptor.intercept(context() as never, {
        handle: () => of({ updated: true }),
      }),
    );

    expect(realtime.publish).toHaveBeenCalledTimes(1);
  });

  it('does not publish when the handler fails and adds audit for admins', async () => {
    const realtime = {
      publish: jest.fn(),
      disconnectInvalidUserSockets: jest.fn(),
    };
    const interceptor = new RealtimeMutationInterceptor(realtime as never);

    await expect(
      lastValueFrom(
        interceptor.intercept(context('admin') as never, {
          handle: () => throwError(() => new Error('rolled back')),
        }),
      ),
    ).rejects.toThrow('rolled back');
    expect(realtime.publish).not.toHaveBeenCalled();

    await lastValueFrom(
      interceptor.intercept(context('admin') as never, {
        handle: () => of({ updated: true }),
      }),
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.arrayContaining(['appointments', 'audit']),
      ['authenticated'],
    );
  });
});
