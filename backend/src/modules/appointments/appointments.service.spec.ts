import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

type QueryHandler = (sql: string, params?: unknown[]) => unknown;

const result = (rows: unknown[] = [], rowCount = rows.length) => ({
  rows,
  rowCount,
});

function createService(handler?: QueryHandler, audit?: any) {
  const client = {
    query: jest.fn((sql: string, params?: unknown[]) =>
      handler ? handler(sql, params) : result(),
    ),
  };
  const database = {
    query: jest.fn((sql: string, params?: unknown[]) =>
      handler ? (handler(sql, params) as any).rows : [],
    ),
    queryOne: jest.fn(),
    transaction: jest.fn(
      async (
        callback: (transactionClient: typeof client) => Promise<unknown>,
      ) => callback(client),
    ),
  };
  return {
    client,
    database,
    service: new AppointmentsService(database as never, audit),
  };
}

const appointmentRow = {
  id: 21,
  reservationRequestId: 10,
  customerId: 7,
  scheduledAt: new Date('2026-07-15T02:00:00.000Z'),
  location: 'Office',
  assignedStaffId: 3,
  assignedStaffName: 'Staff',
  status: 'scheduled',
  note: 'Bring docs',
  statusNote: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AppointmentsService', () => {
  it('creates appointments for approved reservation requests and notifies customer', async () => {
    const { client, service } = createService((sql) => {
      if (sql.includes('FROM reservation_requests')) {
        return result([
          {
            request_id: 10,
            user_id: 7,
            request_type: 'purchase',
            status: 'approved',
          },
        ]);
      }
      if (sql.includes('SELECT appointment_id')) return result([]);
      if (sql.includes('INSERT INTO offline_appointments')) {
        return result([appointmentRow]);
      }
      return result();
    });

    await expect(
      service.create(1, {
        reservationRequestId: 10,
        scheduledAt: '2026-07-15T09:00:00+07:00',
        location: 'Office',
        assignedStaffId: 3,
        note: 'Bring docs',
      }),
    ).resolves.toMatchObject({
      id: 21,
      customerId: 7,
      notificationCreated: true,
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([7, 'appointment_created']),
    );
  });

  it('creates appointments for approved hold requests too', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FROM reservation_requests')) {
        return result([
          {
            request_id: 10,
            user_id: 7,
            request_type: 'reserve',
            status: 'approved',
          },
        ]);
      }
      if (sql.includes('SELECT appointment_id')) return result([]);
      if (sql.includes('INSERT INTO offline_appointments')) {
        return result([appointmentRow]);
      }
      return result();
    });

    await expect(
      service.create(1, {
        reservationRequestId: 10,
        scheduledAt: '2026-07-15T09:00:00+07:00',
        location: 'Office',
        assignedStaffName: 'Staff',
      }),
    ).resolves.toMatchObject({
      id: 21,
      notificationCreated: true,
    });
  });

  it('rejects appointment creation for non-approved requests', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FROM reservation_requests')) {
        return result([
          { request_id: 10, request_type: 'purchase', status: 'pending' },
        ]);
      }
      return result();
    });

    await expect(
      service.create(1, {
        reservationRequestId: 10,
        scheduledAt: '2026-07-15T09:00:00+07:00',
        location: 'Office',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks duplicate scheduled appointments', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FROM reservation_requests')) {
        return result([
          {
            request_id: 10,
            user_id: 7,
            request_type: 'purchase',
            status: 'approved',
          },
        ]);
      }
      if (sql.includes('SELECT appointment_id'))
        return result([{ appointment_id: 1 }]);
      return result();
    });

    await expect(
      service.create(1, {
        reservationRequestId: 10,
        scheduledAt: '2026-07-15T09:00:00+07:00',
        location: 'Office',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists customer appointments with owner scoped query', async () => {
    const { database, service } = createService();
    database.query.mockResolvedValue([appointmentRow]);

    await expect(service.my(7, 'scheduled')).resolves.toEqual([appointmentRow]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE oa.user_id = $1'),
      [7, 'scheduled'],
    );
  });

  it('lists admin appointments with filters', async () => {
    const { database, service } = createService();
    database.queryOne.mockResolvedValue({ total: '1' });
    database.query.mockResolvedValue([appointmentRow]);

    await expect(
      service.adminList({
        status: 'scheduled',
        from: '2026-07-01T00:00:00Z',
        to: '2026-07-31T00:00:00Z',
        page: 1,
        pageSize: 20,
        offset: 0,
      } as never),
    ).resolves.toMatchObject({ items: [appointmentRow], total: 1 });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('oa.scheduled_at <= $3'),
      ['scheduled', '2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z', 20, 0],
    );
  });

  it('updates scheduled appointment details and notifies customer', async () => {
    const { client, service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF oa')) return result([appointmentRow]);
      if (sql.includes('UPDATE offline_appointments')) {
        return result([{ ...appointmentRow, location: 'Main office' }]);
      }
      return result();
    });

    await expect(
      service.update(1, 21, { location: 'Main office' }),
    ).resolves.toMatchObject({
      location: 'Main office',
      notificationCreated: true,
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      expect.arrayContaining([7, 'appointment_updated']),
    );
  });

  it('audits an appointment update inside the transaction', async () => {
    const audit = { record: jest.fn() };
    const { client, service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF oa')) return result([appointmentRow]);
      if (sql.includes('UPDATE offline_appointments')) {
        return result([{ ...appointmentRow, location: 'Văn phòng mới' }]);
      }
      return result();
    }, audit);
    await service.update(
      1,
      21,
      { location: 'Văn phòng mới' },
      {
        adminId: 1,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'appointment.update', entityId: 21 }),
    );
  });

  it('requires status note for cancellation and no-show', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF oa')) return result([appointmentRow]);
      return result();
    });

    await expect(
      service.updateStatus(1, 21, { status: 'cancelled' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes appointment without activating ownership before evidence verification', async () => {
    const { client, service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF oa')) return result([appointmentRow]);
      if (sql.includes('UPDATE offline_appointments')) {
        return result([{ ...appointmentRow, status: 'completed' }]);
      }
      return result();
    });

    await expect(
      service.updateStatus(1, 21, {
        status: 'completed',
        statusNote: 'Signed',
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE contracts'),
      [10],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('awaiting signed evidence verification'),
      [10],
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("SET status = 'active'"),
      ),
    ).toBe(false);
  });

  it('throws not found for missing appointment', async () => {
    const { service } = createService((sql) => {
      if (sql.includes('FOR UPDATE OF oa')) return result([]);
      return result();
    });

    await expect(
      service.update(1, 999, { location: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
