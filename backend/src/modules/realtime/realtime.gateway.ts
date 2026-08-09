import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Socket } from 'socket.io';
import { DatabaseService } from '../../database/database.service';
import { SessionsService } from '../sessions/sessions.service';
import { RealtimeService } from './realtime.service';
import { RealtimeIdentity } from './realtime.types';

function verifyRealtimeOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) {
  if (!origin) return callback(null, true);
  const allowedOrigins = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  )
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
  return callback(new Error('Origin is not allowed'));
}

@WebSocketGateway({
  namespace: '/realtime',
  transports: ['websocket'],
  cors: {
    origin: verifyRealtimeOrigin,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private namespace!: Namespace;
  private readonly expirationTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly database: DatabaseService,
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(namespace: Namespace) {
    this.realtime.attachNamespace(namespace);
    namespace.use((socket, next) => {
      void this.authenticate(socket).then(
        () => next(),
        () => next(new Error('unauthorized')),
      );
    });
  }

  async handleConnection(socket: Socket) {
    await socket.join('public');
    const identity = socket.data.identity as RealtimeIdentity | undefined;
    if (!identity) return;

    await socket.join('authenticated');
    await socket.join(`user:${identity.id}`);
    await socket.join(`role:${identity.role}`);
    if (identity.role === 'admin') await socket.join('admin');

    if (identity.exp) {
      const expiresInMs = identity.exp * 1000 - Date.now();
      if (expiresInMs <= 0) {
        socket.disconnect(true);
        return;
      }
      const timer = setTimeout(() => {
        socket.emit('realtime:session-revoked', {
          reason: 'expired',
          occurredAt: new Date().toISOString(),
        });
        socket.disconnect(true);
      }, expiresInMs);
      timer.unref?.();
      this.expirationTimers.set(socket.id, timer);
    }
  }

  handleDisconnect(socket: Socket) {
    const timer = this.expirationTimers.get(socket.id);
    if (timer) clearTimeout(timer);
    this.expirationTimers.delete(socket.id);
  }

  private async authenticate(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    const authorization = socket.handshake.headers.authorization;
    const headerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const token =
      typeof authToken === 'string' && authToken.trim()
        ? authToken.trim()
        : headerToken;

    // Public map updates are available without authentication. If a token is
    // supplied, however, it must be fully valid; an expired token is not
    // silently downgraded to an anonymous connection.
    if (!token) return;

    const payload = await this.jwtService.verifyAsync<{
      sub: number;
      email: string;
      role: string;
      jti?: string;
      exp?: number;
    }>(token);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('invalid');

    if (payload.jti) {
      const activeSession = await this.sessions.touchSession(payload.jti);
      if (!activeSession || activeSession.user_id !== userId) {
        throw new Error('revoked');
      }
    }

    const user = await this.database.queryOne<{
      user_id: number;
      email: string;
      role: string;
    }>(
      `SELECT user_id, email, role
       FROM users
       WHERE user_id = $1 AND is_active = TRUE AND is_deleted = FALSE`,
      [userId],
    );
    if (!user) throw new Error('inactive');

    socket.data.identity = {
      id: user.user_id,
      email: user.email,
      role: String(user.role).toLowerCase(),
      jti: payload.jti,
      exp: payload.exp,
    } satisfies RealtimeIdentity;
  }
}
