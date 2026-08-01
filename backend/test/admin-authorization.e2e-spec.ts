import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const role = req.headers['x-test-role'];
    if (!role) throw new UnauthorizedException();
    req.user = { id: 1, email: `${role}@test.local`, role };
    return true;
  }
}

const missingId = 999999999;
const adminRoutes: Array<{
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
}> = [
  { method: 'get', path: '/admin/dashboard/summary' },
  { method: 'get', path: '/admin/dashboard/plots' },
  { method: 'get', path: '/admin/dashboard/revenue' },
  { method: 'get', path: '/admin/dashboard/services' },
  { method: 'get', path: '/admin/audit-logs' },
  { method: 'get', path: `/admin/audit-logs/${missingId}` },
  { method: 'get', path: '/admin/users' },
  { method: 'get', path: `/admin/users/${missingId}` },
  { method: 'patch', path: `/admin/users/${missingId}/status` },
  { method: 'get', path: '/admin/plot-zones' },
  { method: 'post', path: '/admin/plot-zones' },
  { method: 'patch', path: `/admin/plot-zones/${missingId}` },
  { method: 'delete', path: `/admin/plot-zones/${missingId}` },
  { method: 'get', path: '/admin/plots' },
  { method: 'post', path: '/admin/plots' },
  { method: 'get', path: `/admin/plots/${missingId}` },
  { method: 'patch', path: `/admin/plots/${missingId}` },
  { method: 'delete', path: `/admin/plots/${missingId}` },
  { method: 'post', path: `/admin/plots/${missingId}/restore` },
  { method: 'patch', path: `/admin/plots/${missingId}/status` },
  { method: 'patch', path: `/admin/plots/${missingId}/price` },
  { method: 'post', path: `/admin/plots/${missingId}/lock` },
  { method: 'post', path: `/admin/plots/${missingId}/unlock` },
  { method: 'get', path: '/admin/reservations' },
  { method: 'get', path: `/admin/reservations/${missingId}` },
  { method: 'patch', path: `/admin/reservations/${missingId}/approve` },
  { method: 'patch', path: `/admin/reservations/${missingId}/reject` },
  { method: 'get', path: '/admin/contracts' },
  { method: 'get', path: `/admin/contracts/${missingId}` },
  { method: 'post', path: `/admin/contracts/${missingId}/payments` },
  { method: 'get', path: '/admin/ownership' },
  { method: 'get', path: '/admin/transfers' },
  { method: 'post', path: '/admin/transfers' },
  { method: 'get', path: '/admin/service-orders' },
  { method: 'post', path: `/admin/service-orders/${missingId}/completion` },
  { method: 'get', path: '/admin/appointments' },
  { method: 'post', path: '/admin/appointments' },
  { method: 'patch', path: `/admin/appointments/${missingId}` },
  { method: 'patch', path: `/admin/appointments/${missingId}/status` },
  { method: 'get', path: '/admin/notifications' },
  { method: 'post', path: '/admin/notifications/broadcast' },
  { method: 'get', path: '/admin/reminders' },
  { method: 'post', path: `/admin/reminders/${missingId}/notify-now` },
  { method: 'get', path: '/ai-agent/admin/ai-activity' },
  { method: 'get', path: '/admin/ai-agent/learning-analytics' },
  { method: 'get', path: '/schedule/admin/appointments' },
];

function call(server: any, route: (typeof adminRoutes)[number]) {
  const operation = request(server)[route.method](route.path);
  return route.method === 'get' ? operation : operation.send({});
}

describe('Admin authorization matrix (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderAuthGuard)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(adminRoutes)(
    '$method $path rejects unauthenticated callers',
    async (route) => {
      await call(app.getHttpServer(), route).expect(401);
    },
  );

  it.each(adminRoutes)(
    '$method $path rejects customer callers',
    async (route) => {
      await call(app.getHttpServer(), route)
        .set('x-test-role', 'customer')
        .expect(403);
    },
  );

  it.each(adminRoutes)(
    '$method $path allows the admin guard layer',
    async (route) => {
      const response = await call(app.getHttpServer(), route).set(
        'x-test-role',
        'admin',
      );
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    },
  );

  it.each([
    '/my/reservations',
    '/my/contracts',
    '/my/service-orders',
    '/notifications',
    '/my/appointments',
  ])('%s remains reachable for customer flows', async (path) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'customer');
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('keeps the public map endpoint available', async () => {
    await request(app.getHttpServer()).get('/plots/map').expect(200);
  });
});
