import { CemeteryServicesService } from './cemetery-services.service';

describe('CemeteryServicesService admin operations', () => {
  it('paginates and filters admin service orders', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 3 }]),
    };
    const service = new CemeteryServicesService(database as never);
    await expect(
      service.adminOrders({
        page: 1,
        pageSize: 20,
        offset: 0,
        search: 'lau dọn',
        status: 'in_progress',
        assigneeId: 2,
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 3 }] });
  });

  it('completes with history, audit and customer notification atomically', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE OF so')) {
          return {
            rows: [{
              order_id: 3,
              user_id: 2,
              status: 'in_progress',
              assigned_to: 1,
              admin_note: null,
              scheduled_date: null,
              service_name: 'Lau dọn',
            }],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(async (callback: any) => callback(client)),
      queryOne: jest.fn().mockResolvedValue({ id: 3 }),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new CemeteryServicesService(database as never);
    await service.complete(
      3,
      { completionNote: 'Đã xong' },
      1,
      [{ filename: 'proof.jpg' }] as Express.Multer.File[],
    );
    const sql = client.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('INSERT INTO service_order_history');
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(sql).toContain('INSERT INTO notifications');
  });
});
