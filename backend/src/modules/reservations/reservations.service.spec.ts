import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';

type QueryHandler = (sql: string, params?: unknown[]) => unknown;

const result = (rows: unknown[] = [], rowCount = rows.length) => ({
  rows,
  rowCount,
});

function createService(handler?: QueryHandler, adjacency?: any, audit?: any) {
  const client = {
    query: jest.fn((sql: string, params?: unknown[]) =>
      handler ? handler(sql, params) : result(),
    ),
  };
  const database = {
    query: jest.fn(),
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
    service: new ReservationsService(
      database as never,
      adjacency,
      undefined,
      audit,
    ),
  };
}

describe('ReservationsService', () => {
  it('paginates and filters admin requests by status, type and AI source', async () => {
    const { database, service } = createService();
    database.queryOne.mockResolvedValue({ total: '1' });
    database.query.mockResolvedValue([{ id: 10, source: 'ai' }]);
    await expect(
      service.adminList({
        page: 2,
        pageSize: 10,
        offset: 10,
        status: 'pending',
        type: 'purchase',
        source: 'ai',
      } as never),
    ).resolves.toMatchObject({ total: 1, page: 2, items: [{ id: 10 }] });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('is_ai_draft'),
      ['pending', 'purchase', true, 10, 10],
    );
  });
  describe('create', () => {
    it('creates a pending multi-plot reservation in a transaction', async () => {
      const { client, database, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([
            { id: 1, code: 'A-01-001', status: 'available', price: 100 },
            { id: 2, code: 'A-01-002', status: 'available', price: 150 },
          ]);
        }
        if (sql.includes('INSERT INTO reservation_requests')) {
          return result([{ id: 10 }]);
        }
        if (sql.includes('UPDATE plots')) {
          return result([], 2);
        }
        if (sql.includes('FROM reservation_requests rr')) {
          return result([
            {
              id: 10,
              type: 'reserve',
              status: 'pending',
              totalPrice: 250,
              note: 'hold',
              createdAt: new Date('2026-07-03T00:00:00Z'),
            },
          ]);
        }
        if (
          sql.includes('FROM request_plots rp') &&
          !sql.includes('FOR UPDATE')
        ) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
            { id: 2, code: 'A-01-002', status: 'pending', price: 150 },
          ]);
        }
        return result();
      });

      const created = await service.create(7, {
        type: 'reserve',
        plotIds: [1, 2],
        note: 'hold',
      });

      expect(database.transaction).toHaveBeenCalledTimes(1);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("VALUES ($1, $2, 'pending'"),
        [7, 'reserve', 250, 'hold', false],
      );
      expect(created).toMatchObject({
        id: 10,
        status: 'pending',
        totalPrice: 250,
        plotCount: 2,
        plotCodes: ['A-01-001', 'A-01-002'],
      });
    });

    it('rejects duplicate plot IDs before opening a transaction', async () => {
      const { database, service } = createService();

      await expect(
        service.create(7, { type: 'purchase', plotIds: [1, 1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(database.transaction).not.toHaveBeenCalled();
    });

    it('rejects unavailable plots without partial writes', async () => {
      const { client, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
          ]);
        }
        return result();
      });

      await expect(
        service.create(7, { type: 'purchase', plotIds: [1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        client.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO reservation_requests'),
        ),
      ).toBe(false);
    });

    it.each(['sold', 'reserved', 'locked'])(
      'rejects %s plots without partial writes',
      async (status) => {
        const { client, service } = createService((sql) => {
          if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
            return result([{ id: 1, code: 'A-01-001', status, price: 100 }]);
          }
          return result();
        });

        await expect(
          service.create(7, { type: 'purchase', plotIds: [1] }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(
          client.query.mock.calls.some(([sql]) =>
            String(sql).includes('INSERT INTO reservation_requests'),
          ),
        ).toBe(false);
      },
    );

    it('rejects a deleted or missing plot without partial writes', async () => {
      const { client, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([]);
        }
        return result();
      });

      await expect(
        service.create(7, { type: 'purchase', plotIds: [1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        client.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO reservation_requests'),
        ),
      ).toBe(false);
    });

    it('rejects a changed total before creating any request rows', async () => {
      const { client, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([
            { id: 1, code: 'A-01-001', status: 'available', price: 120 },
          ]);
        }
        return result();
      });

      await expect(
        service.create(7, { type: 'purchase', plotIds: [1] }, false, 100),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        client.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO reservation_requests'),
        ),
      ).toBe(false);
    });

    it('creates a pending adjacent multi-plot reservation with adjacency metadata', async () => {
      const adjacency = {
        validateAdjacent: jest.fn(() => ({ valid: true, method: 'map' })),
      };
      const { client, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([
            {
              id: 1,
              code: 'A-01-001',
              status: 'available',
              price: 100,
              mapX: 0,
              mapY: 0,
              mapWidth: 40,
              mapHeight: 40,
            },
            {
              id: 2,
              code: 'A-01-002',
              status: 'available',
              price: 150,
              mapX: 40,
              mapY: 0,
              mapWidth: 40,
              mapHeight: 40,
            },
          ]);
        }
        if (sql.includes('INSERT INTO reservation_requests')) {
          return result([{ id: 10 }]);
        }
        if (sql.includes('UPDATE plots')) {
          return result([], 2);
        }
        if (sql.includes('FROM reservation_requests rr')) {
          return result([
            {
              id: 10,
              type: 'purchase',
              status: 'pending',
              totalPrice: 250,
              createdAt: new Date('2026-07-03T00:00:00Z'),
            },
          ]);
        }
        if (
          sql.includes('FROM request_plots rp') &&
          !sql.includes('FOR UPDATE')
        ) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
            { id: 2, code: 'A-01-002', status: 'pending', price: 150 },
          ]);
        }
        return result();
      }, adjacency);

      await expect(
        service.createMultiple(7, {
          type: 'purchase',
          plotIds: [1, 2],
          note: 'family',
        }),
      ).resolves.toMatchObject({
        id: 10,
        plotCount: 2,
        adjacency: { valid: true, method: 'map' },
      });
      expect(adjacency.validateAdjacent).toHaveBeenCalledTimes(1);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plots'),
        [[1, 2]],
      );
    });

    it('rejects non-adjacent multi-plot requests without partial writes', async () => {
      const adjacency = {
        validateAdjacent: jest.fn(() => {
          throw new BadRequestException(
            'Selected plots must be adjacent or near each other',
          );
        }),
      };
      const { client, service } = createService((sql) => {
        if (sql.includes('FROM plots') && sql.includes('FOR UPDATE')) {
          return result([
            { id: 1, code: 'A-01-001', status: 'available', price: 100 },
            { id: 2, code: 'B-01-001', status: 'available', price: 150 },
          ]);
        }
        return result();
      }, adjacency);

      await expect(
        service.createMultiple(7, { type: 'reserve', plotIds: [1, 2] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        client.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO reservation_requests'),
        ),
      ).toBe(false);
    });

    it('requires at least two plots for multi-plot requests before transaction', async () => {
      const { database, service } = createService();

      await expect(
        service.createMultiple(7, { type: 'reserve', plotIds: [1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(database.transaction).not.toHaveBeenCalled();
    });
  });

  describe('releaseExpiredReservations', () => {
    it('cancels expired requests and releases plots with no active request', async () => {
      const { client, service } = createService((sql) => {
        if (sql.includes('UPDATE reservation_requests')) {
          return result([{ id: 10 }], 1);
        }
        if (sql.includes('UPDATE plots p')) {
          return result([{ id: 1 }], 1);
        }
        return result();
      });

      await expect(service.releaseExpiredReservations()).resolves.toEqual({
        requestsCancelled: 1,
        plotsReleased: 1,
      });
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("rr.status IN ('pending', 'submitted')"),
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'available'"),
        [['pending', 'submitted', 'approved']],
      );
    });
  });

  describe('approve', () => {
    it('approves a reserve request, reserves plots, and creates a notification', async () => {
      const { client, service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([
            {
              request_id: 10,
              user_id: 7,
              request_type: 'reserve',
              status: 'pending',
            },
          ]);
        }
        if (
          sql.includes('FROM request_plots rp') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
          ]);
        }
        if (sql.includes('UPDATE plots')) {
          return result([], 1);
        }
        return result();
      });

      await expect(service.approve(1, 10, 'ok')).resolves.toEqual({
        id: 10,
        status: 'approved',
        plotStatus: 'reserved',
        notificationCreated: true,
      });
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plots'),
        [[1], 'reserved'],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([7, 'request_approved']),
      );
    });

    it('approves a purchase request as reserved until offline signing', async () => {
      const { client, service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([
            {
              request_id: 10,
              user_id: 7,
              request_type: 'purchase',
              status: 'pending',
            },
          ]);
        }
        if (
          sql.includes('FROM request_plots rp') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
          ]);
        }
        if (sql.includes('UPDATE plots')) {
          return result([], 1);
        }
        if (sql.includes('SELECT full_name')) {
          return result([
            {
              full_name: 'Nguyen Van A',
              id_card_number: '012345678901',
              phone_number: '0900000000',
              address: 'Ha Noi',
            },
          ]);
        }
        if (sql.includes('INSERT INTO contracts')) {
          return result([{ id: 99, contractCode: 'HD-2026-10-1' }]);
        }
        return result();
      });

      await expect(service.approve(1, 10)).resolves.toMatchObject({
        plotStatus: 'reserved',
        contracts: [{ id: 99, contractCode: 'HD-2026-10-1' }],
      });
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plots'),
        [[1], 'reserved'],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contracts'),
        expect.arrayContaining([
          expect.stringMatching(/^HD-\d{4}-10-1$/),
          10,
          7,
          1,
        ]),
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("'draft'"),
        expect.any(Array),
      );
    });

    it('rejects approving a non-pending request', async () => {
      const { service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([{ request_id: 10, status: 'approved' }]);
        }
        return result();
      });

      await expect(service.approve(1, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('reject', () => {
    it('rejects a pending request, releases plots, and creates a notification', async () => {
      const { client, service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([{ request_id: 10, user_id: 7, status: 'pending' }]);
        }
        if (
          sql.includes('FROM request_plots rp') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([
            { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
          ]);
        }
        return result();
      });

      await expect(service.reject(1, 10, 'no')).resolves.toEqual({
        id: 10,
        status: 'rejected',
        plotStatus: 'available',
        notificationCreated: true,
      });
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'available'"),
        [[1], 10, ['pending', 'submitted', 'approved']],
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([7, 'request_rejected']),
      );
    });

    it('blocks repeated rejection for finalized requests', async () => {
      const { service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([{ request_id: 10, user_id: 7, status: 'rejected' }]);
        }
        return result();
      });

      await expect(service.reject(1, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('keeps audit in the decision transaction and propagates audit failure', async () => {
      const audit = {
        record: jest.fn().mockRejectedValue(new Error('audit failed')),
      };
      const { client, database, service } = createService(
        (sql) => {
          if (
            sql.includes('FROM reservation_requests') &&
            sql.includes('FOR UPDATE')
          ) {
            return result([
              {
                request_id: 10,
                user_id: 7,
                request_type: 'reserve',
                status: 'pending',
              },
            ]);
          }
          if (
            sql.includes('FROM request_plots') &&
            sql.includes('FOR UPDATE')
          ) {
            return result([{ id: 1, status: 'pending', price: 100 }]);
          }
          return result([], 1);
        },
        undefined,
        audit,
      );
      await expect(
        service.reject(1, 10, 'Từ chối', {
          adminId: 1,
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        }),
      ).rejects.toThrow('audit failed');
      expect(database.transaction).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          action: 'reservation.reject',
          entityId: 10,
        }),
      );
    });

    it('does not create a notification when a decision fails', async () => {
      const { client, service } = createService((sql) => {
        if (
          sql.includes('FROM reservation_requests') &&
          sql.includes('FOR UPDATE')
        ) {
          return result([{ request_id: 10, user_id: 7, status: 'rejected' }]);
        }
        return result();
      });

      await expect(service.reject(1, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(
        client.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO notifications'),
        ),
      ).toBe(false);
    });
  });

  describe('read models', () => {
    it('lists customer reservations with plot summaries', async () => {
      const { database, service } = createService();
      database.query.mockResolvedValue([{ id: 10, plotCount: 2 }]);

      await expect(service.my(7)).resolves.toEqual([{ id: 10, plotCount: 2 }]);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE rr.user_id = $1'),
        [7],
      );
    });

    it('returns customer details with joined plots', async () => {
      const { database, service } = createService();
      database.queryOne.mockResolvedValue({
        id: 10,
        type: 'purchase',
        status: 'pending',
        totalPrice: '100',
      });
      database.query.mockResolvedValue([
        {
          id: 1,
          code: 'A-01-001',
          status: 'pending',
          price: '100',
          mapX: '10',
          mapY: '20',
          mapWidth: '40',
          mapHeight: '40',
        },
      ]);

      await expect(service.myOne(7, 10)).resolves.toMatchObject({
        id: 10,
        plotCount: 1,
        plotCodes: ['A-01-001'],
        plots: [{ mapX: 10, mapY: 20 }],
      });
    });

    it('throws not found for missing customer detail', async () => {
      const { database, service } = createService();
      database.queryOne.mockResolvedValue(null);

      await expect(service.myOne(7, 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lists and loads admin reservation views', async () => {
      const { database, service } = createService();
      database.queryOne.mockResolvedValueOnce({ total: '1' });
      database.query.mockResolvedValueOnce([
        { id: 10, customerName: 'Customer' },
      ]);

      await expect(service.adminList()).resolves.toMatchObject({
        items: [{ id: 10, customerName: 'Customer' }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM vw_reservation_requests_full'),
        [20, 0],
      );

      database.queryOne.mockResolvedValueOnce({
        id: 10,
        customerName: 'Customer',
        totalPrice: 100,
      });
      database.query.mockResolvedValueOnce([
        { id: 1, code: 'A-01-001', status: 'pending', price: 100 },
      ]);

      await expect(service.adminOne(10)).resolves.toMatchObject({
        id: 10,
        customerName: 'Customer',
        plotCount: 1,
      });
    });
  });
});
