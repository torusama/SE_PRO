import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { RealtimeRoom, RealtimeTopic } from './realtime.types';

interface AuthenticatedRequest {
  method?: string;
  originalUrl?: string;
  user?: { id?: number; jti?: string; role?: string };
}

export interface RealtimeMutation {
  topics: RealtimeTopic[];
  rooms: RealtimeRoom[];
  revalidateUserId?: number;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function actorAndAdminRooms(userId?: number): RealtimeRoom[] {
  return userId ? [`user:${userId}`, 'admin'] : ['admin'];
}

function authenticatedRooms(): RealtimeRoom[] {
  return ['authenticated'];
}

export function classifyRealtimeMutation(
  method: string | undefined,
  rawUrl: string | undefined,
  actorUserId?: number,
): RealtimeMutation | null {
  if (!method || !MUTATION_METHODS.has(method.toUpperCase()) || !rawUrl) {
    return null;
  }

  const path = rawUrl.split('?')[0].replace(/^\/api(?=\/|$)/, '').replace(/\/$/, '');
  const lower = path.toLowerCase();

  // OTP and password-reveal calls only update short-lived security metadata and
  // must not cause profile forms to reload while the user is completing them.
  if (
    lower.includes('/send-otp') ||
    lower.includes('/verify-otp') ||
    lower.endsWith('/id-card/reveal') ||
    lower === '/auth/login' ||
    lower === '/auth/forgot-password'
  ) {
    return null;
  }

  if (lower === '/auth/register') {
    return { topics: ['users', 'dashboard'], rooms: ['admin'] };
  }
  if (lower === '/auth/logout') {
    return {
      topics: ['sessions'],
      rooms: actorUserId ? [`user:${actorUserId}`] : [],
      revalidateUserId: actorUserId,
    };
  }

  if (lower.startsWith('/users/me/authorized-persons')) {
    return {
      topics: ['authorized-persons', 'users'],
      rooms: actorAndAdminRooms(actorUserId),
    };
  }
  if (lower.startsWith('/users/me/sessions')) {
    return {
      topics: ['sessions'],
      rooms: actorUserId ? [`user:${actorUserId}`] : [],
      revalidateUserId: actorUserId,
    };
  }
  if (lower.startsWith('/users/me')) {
    const passwordChange = lower.endsWith('/password');
    return {
      topics: passwordChange ? ['users', 'sessions'] : ['users'],
      rooms: actorAndAdminRooms(actorUserId),
      revalidateUserId: passwordChange ? actorUserId : undefined,
    };
  }
  if (lower.startsWith('/admin/users')) {
    const target = /\/admin\/users\/(\d+)/.exec(lower);
    const targetUserId = target ? Number(target[1]) : undefined;
    return {
      topics: ['users', 'sessions', 'dashboard', 'audit'],
      rooms: targetUserId ? ['admin', `user:${targetUserId}`] : ['admin'],
      revalidateUserId: targetUserId,
    };
  }

  if (lower.startsWith('/notifications')) {
    return {
      topics: ['notifications'],
      rooms: actorUserId ? [`user:${actorUserId}`] : [],
    };
  }
  if (lower.startsWith('/admin/notifications')) {
    return {
      topics: ['notifications', 'audit'],
      rooms: authenticatedRooms(),
    };
  }

  if (
    lower.startsWith('/admin/plot-zones') ||
    lower.startsWith('/admin/plots')
  ) {
    return {
      topics: ['plots', 'dashboard', 'audit'],
      rooms: ['admin'],
    };
  }

  if (lower.startsWith('/reservations') || lower.startsWith('/admin/reservations')) {
    return {
      topics: [
        'reservations',
        'plots',
        'contracts',
        'notifications',
        'dashboard',
        ...(lower.startsWith('/admin/') ? (['audit'] as RealtimeTopic[]) : []),
      ],
      rooms: authenticatedRooms(),
    };
  }

  if (lower.startsWith('/admin/contracts')) {
    return {
      topics: [
        'contracts',
        'ownership',
        'plots',
        'reservations',
        'notifications',
        'dashboard',
        'audit',
      ],
      rooms: authenticatedRooms(),
    };
  }

  if (lower.startsWith('/admin/transfers')) {
    return {
      topics: [
        'transfers',
        'ownership',
        'contracts',
        'plots',
        'notifications',
        'dashboard',
        'audit',
      ],
      rooms: authenticatedRooms(),
    };
  }

  if (
    lower.startsWith('/service-orders') ||
    lower.startsWith('/admin/service-orders')
  ) {
    return {
      topics: [
        'services',
        'notifications',
        'dashboard',
        ...(lower.startsWith('/admin/') ? (['audit'] as RealtimeTopic[]) : []),
      ],
      rooms: authenticatedRooms(),
    };
  }

  if (
    lower.startsWith('/admin/appointments') ||
    lower.startsWith('/my/appointments') ||
    lower.startsWith('/schedule/')
  ) {
    return {
      topics: ['appointments', 'notifications', 'dashboard'],
      rooms: authenticatedRooms(),
    };
  }

  if (lower.startsWith('/my/reminders')) {
    return {
      topics: ['reminders', 'notifications'],
      rooms: actorAndAdminRooms(actorUserId),
    };
  }
  if (lower.startsWith('/admin/reminders')) {
    return {
      topics: ['reminders', 'notifications', 'audit'],
      rooms: authenticatedRooms(),
    };
  }

  if (
    lower.startsWith('/deceased') ||
    lower.startsWith('/admin/deceased') ||
    lower.startsWith('/families') ||
    lower.startsWith('/family-invitations')
  ) {
    return {
      topics: ['deceased', 'families', 'plots', 'notifications'],
      rooms: authenticatedRooms(),
    };
  }

  if (lower.startsWith('/admin/ai-agent')) {
    return { topics: ['ai', 'audit'], rooms: ['admin'] };
  }
  if (lower.startsWith('/ai-agent')) {
    const createsReservation = lower.endsWith('/create-draft-reservation');
    return {
      topics: createsReservation
        ? ['ai', 'reservations', 'plots', 'notifications']
        : ['ai'],
      rooms: actorAndAdminRooms(actorUserId),
    };
  }

  return null;
}

@Injectable()
export class RealtimeMutationInterceptor implements NestInterceptor {
  constructor(private readonly realtime: RealtimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const mutation = classifyRealtimeMutation(
      request.method,
      request.originalUrl,
      request.user?.id,
    );
    if (!mutation) return next.handle();
    if (
      request.user?.role?.toLowerCase() === 'admin' &&
      !mutation.topics.includes('audit')
    ) {
      mutation.topics = [...mutation.topics, 'audit'];
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.realtime.publish(mutation.topics, mutation.rooms);
          if (mutation.revalidateUserId) {
            void this.realtime.disconnectInvalidUserSockets(
              mutation.revalidateUserId,
            );
          }
        },
      }),
    );
  }
}
