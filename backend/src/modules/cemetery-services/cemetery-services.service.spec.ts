import { BadRequestException } from '@nestjs/common';
import { CemeteryServicesService } from './cemetery-services.service';

const result = (rows: unknown[] = []) => ({ rows, rowCount: rows.length });

function createService(
  handler: (sql: string, params?: unknown[]) => { rows: unknown[] } = () =>
    result(),
) {
  const client = {
    query: jest.fn((sql: string, params?: unknown[]) => handler(sql, params)),
  };
  const database = {
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue({ id: 12 }),
    transaction: jest.fn(
      async (
        callback: (transactionClient: typeof client) => Promise<unknown>,
      ) => callback(client),
    ),
  };
  return {
    client,
    database,
    service: new CemeteryServicesService(database as never),
  };
}

const currentOrder = {
  order_id: 12,
  user_id: 7,
  status: 'submitted',
  assigned_to: null,
  admin_note: null,
  scheduled_date: null,
  service_name: 'Chăm sóc phần mộ',
};

describe('CemeteryServicesService', () => {
  it('rejects unknown statuses before querying the database', async () => {
    const { database, service } = createService();

    await expect(service.updateStatus(12, 'unknown', 2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('blocks invalid transitions from a terminal status', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF so')) {
        return result([{ ...currentOrder, status: 'completed' }]);
      }
      return result();
    });

    await expect(
      service.update(12, { status: 'in_progress' }, 2),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates, records history and notifies on status changes', async () => {
    const { client, service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF so')) return result([currentOrder]);
      if (sql.includes('FROM users') && sql.includes('LOWER(role)')) {
        return result([{ user_id: 2 }]);
      }
      return result();
    });

    await expect(
      service.update(
        12,
        {
          status: 'confirmed',
          assignedTo: 2,
          adminNote: 'Đã liên hệ khách hàng',
          scheduledDate: '2026-07-28',
        },
        2,
      ),
    ).resolves.toMatchObject({ id: 12 });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE service_orders'),
      expect.arrayContaining([12, 'confirmed', 2]),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_order_history'),
      expect.any(Array),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.any(Array),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([7, 'service_confirmed']),
    );
  });

  it('requires completion evidence', async () => {
    const { database, service } = createService();

    await expect(
      service.complete(12, { completionNote: 'Đã xong' }, 2, []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('returns only customer-safe status history for an owned order', async () => {
    const { database, service } = createService();
    database.queryOne.mockResolvedValue({
      id: 12,
      status: 'confirmed',
      completionNote: null,
    });
    database.query.mockResolvedValue([
      {
        id: 1,
        action: 'status_confirmed',
        previousStatus: 'submitted',
        newStatus: 'confirmed',
      },
    ]);

    await expect(service.one(12, 7)).resolves.toMatchObject({
      id: 12,
      history: [{ newStatus: 'confirmed' }],
    });
    expect(database.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('so.user_id = $2'),
      [12, 7],
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.not.stringContaining('h.note'),
      [12],
    );
  });
});
