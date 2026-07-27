import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AdminRequestContext {
  adminId: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export const CurrentAdminContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminRequestContext => {
    const request = context.switchToHttp().getRequest<
      Request & { user?: { id?: number } }
    >();
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    return {
      adminId: Number(request.user?.id ?? 0),
      ipAddress: forwardedIp || request.ip || request.socket.remoteAddress || null,
      userAgent:
        typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent']
          : null,
    };
  },
);
