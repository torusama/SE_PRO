import { CemeteryServicesService } from './cemetery-services.service';

describe('CemeteryServicesService admin operations', () => {
  it('reuses an equivalent active service order instead of creating a duplicate', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM service_orders')) {
          return {
            rows: [{ id: 18, status: 'submitted', amount: 200_000 }],
          };
        }
        return { rows: [] };
      }),
    };
    const database = {
      queryOne: jest.fn((sql: string) => {
        if (sql.includes('FROM service_types')) {
          return Promise.resolve({
            service_type_id: 3,
            base_price: '200000',
            name: 'Dọn dẹp mộ',
          });
        }
        if (sql.includes('FROM ownership_records')) {
          return Promise.resolve({ owned: true });
        }
        return Promise.resolve(undefined);
      }),
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
    };
    const service = new CemeteryServicesService(database as never);

    await expect(
      service.createOrder(7, {
        serviceTypeId: 3,
        plotId: 10,
        requestedDate: '2099-08-10',
      }),
    ).resolves.toMatchObject({
      id: 18,
      status: 'submitted',
      reused: true,
    });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO service_orders'),
      ),
    ).toBe(false);
  });

  it('allows the customer to report payment before admin service confirmation', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE OF so')) {
          return {
            rows: [
              {
                order_id: 22,
                user_id: 7,
                status: 'submitted',
                payment_status: 'unpaid',
                payment_code: null,
                amount: '100000',
                service_name: 'Thắp hương',
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
      queryOne: jest.fn().mockResolvedValue({ id: 22 }),
      query: jest.fn().mockResolvedValue([]),
    };
    const emailService = {};
    const service = new CemeteryServicesService(
      database as never,
      emailService as never,
    );

    await expect(service.markPaid(22, 7)).resolves.toMatchObject({ id: 22 });
    const sql = client.query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain("payment_status = 'awaiting_confirmation'");
    expect(sql).toContain("'payment_reported'");
  });

  it('allows the owner to cancel one unpaid service order before work starts', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE OF so')) {
          return {
            rows: [
              {
                order_id: 31,
                user_id: 7,
                status: 'submitted',
                payment_status: 'unpaid',
                payment_code: null,
                amount: '150000',
                service_name: 'Thắp hương',
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
      queryOne: jest.fn().mockResolvedValue({
        id: 31,
        status: 'cancelled',
        serviceName: 'Thắp hương',
      }),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new CemeteryServicesService(database as never, {} as never);

    await expect(service.cancelByCustomer(31, 7)).resolves.toMatchObject({
      id: 31,
      status: 'cancelled',
    });
    const sql = client.query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain("SET status = 'cancelled'");
    expect(sql).toContain("'customer_cancelled'");
    expect(sql).toContain("'service_customer_cancelled'");
  });

  it('blocks customer self-cancellation after payment was reported', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE OF so')) {
          return {
            rows: [
              {
                order_id: 32,
                user_id: 7,
                status: 'confirmed',
                payment_status: 'awaiting_confirmation',
                payment_code: 'VPV00032',
                amount: '150000',
                service_name: 'Thắp hương',
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
    };
    const service = new CemeteryServicesService(database as never, {} as never);

    await expect(service.cancelByCustomer(32, 7)).rejects.toThrow(
      'Đơn đã ghi nhận thanh toán',
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("SET status = 'cancelled'"),
      ),
    ).toBe(false);
  });

  it('allows choosing the service date only after payment is reported', async () => {
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                user_id: 7,
                status: 'submitted',
                payment_status: 'awaiting_confirmation',
                requested_date: null,
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
      queryOne: jest.fn().mockResolvedValue({ id: 22 }),
      query: jest.fn().mockResolvedValue([]),
    };
    const emailService = {};
    const service = new CemeteryServicesService(
      database as never,
      emailService as never,
    );

    await expect(
      service.setRequestedDateAfterPayment(22, 7, '2099-08-20'),
    ).resolves.toMatchObject({ id: 22 });
    const sql = client.query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('SET requested_date = $3::date');
    expect(sql).toContain("'requested_date_updated'");
  });

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
            rows: [
              {
                order_id: 3,
                user_id: 2,
                status: 'in_progress',
                assigned_to: 1,
                admin_note: null,
                scheduled_date: null,
                service_name: 'Lau dọn',
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const database = {
      transaction: jest.fn(
        (callback: (transactionClient: typeof client) => unknown) =>
          callback(client),
      ),
      queryOne: jest.fn().mockResolvedValue({ id: 3 }),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new CemeteryServicesService(database as never);
    await service.complete(3, { completionNote: 'Đã xong' }, 1, [
      { filename: 'proof.jpg' },
    ] as Express.Multer.File[]);
    const sql = client.query.mock.calls
      .map(([statement]) => statement)
      .join('\n');
    expect(sql).toContain('INSERT INTO service_order_history');
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(sql).toContain('INSERT INTO notifications');
  });
});
