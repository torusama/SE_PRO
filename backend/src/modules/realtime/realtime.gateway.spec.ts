import { RealtimeGateway } from './realtime.gateway';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';

function setup(options?: {
  payload?: Record<string, unknown>;
  session?: { user_id: number } | null;
  user?: { user_id: number; email: string; role: string } | null;
}) {
  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue(
      options?.payload ?? {
        sub: 7,
        email: 'token@example.test',
        role: 'customer',
        jti: 'session-7',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ),
  };
  const database = {
    queryOne: jest.fn().mockResolvedValue(
      options && 'user' in options
        ? options.user
        : { user_id: 7, email: 'admin@example.test', role: 'Admin' },
    ),
  };
  const sessions = {
    touchSession: jest.fn().mockResolvedValue(
      options && 'session' in options
        ? options.session
        : { user_id: 7 },
    ),
  };
  const realtime = { attachNamespace: jest.fn() };
  const middleware: { current?: (...args: any[]) => any } = {};
  const namespace = {
    use: jest.fn((value: (...args: any[]) => any) => {
      middleware.current = value;
    }),
  };
  const gateway = new RealtimeGateway(
    jwt as never,
    database as never,
    sessions as never,
    realtime as never,
  );
  gateway.afterInit(namespace as never);
  return { gateway, jwt, database, sessions, realtime, middleware, namespace };
}

function socket(token?: string) {
  return {
    id: 'socket-1',
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

async function runMiddleware(
  middleware: (...args: any[]) => any,
  client: object,
) {
  return new Promise<unknown>((resolve) => middleware(client, resolve));
}

describe('RealtimeGateway', () => {
  it('keeps Socket.IO polling available with websocket upgrade', () => {
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, RealtimeGateway);

    expect(options.transports).toBeUndefined();
  });

  it('allows anonymous clients into only the public room', async () => {
    const { gateway, middleware } = setup();
    const client = socket();

    await expect(
      runMiddleware(middleware.current!, client),
    ).resolves.toBeUndefined();
    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('public');
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  it('uses the database role and durable session for private rooms', async () => {
    const { gateway, middleware, sessions, database } = setup();
    const client = socket('valid-token');

    await expect(
      runMiddleware(middleware.current!, client),
    ).resolves.toBeUndefined();
    await gateway.handleConnection(client as never);

    expect(sessions.touchSession).toHaveBeenCalledWith('session-7');
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('is_active = TRUE'),
      [7],
    );
    expect(client.join).toHaveBeenCalledWith('authenticated');
    expect(client.join).toHaveBeenCalledWith('user:7');
    expect(client.join).toHaveBeenCalledWith('role:admin');
    expect(client.join).toHaveBeenCalledWith('admin');
  });

  it('rejects a token whose session was revoked', async () => {
    const { middleware } = setup({ session: null });
    const client = socket('revoked-token');

    const error = await runMiddleware(middleware.current!, client);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('unauthorized');
    expect(client.data).toEqual({});
  });

  it('rejects an inactive account even when the signature is valid', async () => {
    const { middleware } = setup({ user: null });
    const client = socket('inactive-user-token');

    const error = await runMiddleware(middleware.current!, client);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('unauthorized');
  });
});
