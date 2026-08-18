import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('splits public plot invalidation from protected workflow topics', () => {
    const publicOperator = { emit: jest.fn(), to: jest.fn() };
    const protectedOperator = { emit: jest.fn(), to: jest.fn() };
    const namespace = {
      to: jest
        .fn()
        .mockReturnValueOnce(publicOperator)
        .mockReturnValueOnce(protectedOperator),
    };
    const service = new RealtimeService({} as never);
    service.attachNamespace(namespace as never);

    service.publish(
      ['plots', 'reservations', 'plots'],
      ['authenticated'],
    );

    expect(namespace.to).toHaveBeenNthCalledWith(1, 'public');
    expect(publicOperator.emit).toHaveBeenCalledWith(
      'realtime:update',
      expect.objectContaining({ topics: ['plots'] }),
    );
    expect(namespace.to).toHaveBeenNthCalledWith(2, 'authenticated');
    expect(protectedOperator.emit).toHaveBeenCalledWith(
      'realtime:update',
      expect.objectContaining({ topics: ['reservations'] }),
    );
  });

  it('disconnects only sockets backed by a revoked session', async () => {
    const active = {
      data: { identity: { jti: 'active' } },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const revoked = {
      data: { identity: { jti: 'revoked' } },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const namespace = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([active, revoked]),
      }),
    };
    const database = {
      query: jest.fn().mockResolvedValue([{ jti: 'active' }]),
    };
    const service = new RealtimeService(database as never);
    service.attachNamespace(namespace as never);

    await service.disconnectInvalidUserSockets(8);

    expect(active.disconnect).not.toHaveBeenCalled();
    expect(revoked.emit).toHaveBeenCalledWith(
      'realtime:session-revoked',
      expect.any(Object),
    );
    expect(revoked.disconnect).toHaveBeenCalledWith(true);
  });
});
