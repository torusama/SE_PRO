import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

function setup(handler?: (sql: string, params?: unknown[]) => any) {
  const client = {
    query: jest.fn((sql: string, params?: unknown[]) =>
      handler ? handler(sql, params) : { rows: [], rowCount: 0 },
    ),
  };
  const database = {
    queryOne: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn(async (callback: any) => callback(client)),
  };
  const notifications = {
    createInApp: jest.fn(),
    createInAppWithClient: jest.fn(),
  };
  const audit = { record: jest.fn() };
  return {
    client,
    database,
    notifications,
    audit,
    service: new ContractsService(database as never, notifications as never, audit as never),
  };
}

describe('ContractsService admin operations', () => {
  it('returns a paginated filtered contract list', async () => {
    const { database, service } = setup();
    database.queryOne.mockResolvedValue({ total: '1' });
    database.query.mockResolvedValue([{ id: 1, customerIdCard: '******8901' }]);
    await expect(
      service.adminList({
        page: 1,
        pageSize: 20,
        offset: 0,
        search: 'HD-1',
        status: 'active',
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 1 }] });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('RIGHT(u.id_card_number, 4)'),
      ['%HD-1%', 'active', 20, 0],
    );
  });

  it('includes payment and ownership history in detail', async () => {
    const { database, service } = setup();
    database.queryOne.mockResolvedValue({ id: 1 });
    database.query
      .mockResolvedValueOnce([{ id: 3, amount: 100 }])
      .mockResolvedValueOnce([{ id: 4, isCurrent: true }]);
    await expect(service.adminOne(1)).resolves.toMatchObject({
      payments: [{ id: 3 }],
      ownershipHistory: [{ id: 4 }],
    });
  });

  it('rejects duplicate and overpayment before writes', async () => {
    const over = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 1, totalAmount: 100, paidAmount: 90, paymentStatus: 'partial' }] };
      }
      return { rows: [], rowCount: 0 };
    });
    await expect(
      over.service.addPayment(1, { amount: 20, paymentMethod: 'cash' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    const duplicate = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 1, totalAmount: 100, paidAmount: 0, paymentStatus: 'unpaid' }] };
      }
      if (sql.includes('SELECT 1 FROM payment_transactions')) return { rows: [{ exists: 1 }] };
      return { rows: [], rowCount: 0 };
    });
    await expect(
      duplicate.service.addPayment(
        1,
        { amount: 20, paymentMethod: 'bank_transfer', referenceCode: 'REF-1' },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records payment, notification and audit inside one transaction', async () => {
    const { client, notifications, audit, service } = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return { rows: [{ id: 1, contractCode: 'HD-1', userId: 2, totalAmount: 100, paidAmount: 0, paymentStatus: 'unpaid' }] };
      }
      if (sql.includes('INSERT INTO payment_transactions')) {
        return { rows: [{ id: 8, amount: 100, paymentMethod: 'cash' }] };
      }
      if (sql.includes('UPDATE contracts')) {
        return { rows: [{ id: 1, contractCode: 'HD-1', userId: 2, totalAmount: 100, paidAmount: 100, paymentStatus: 'paid' }] };
      }
      return { rows: [], rowCount: 0 };
    });
    await service.addPayment(1, { amount: 100, paymentMethod: 'cash' }, 9);
    expect(notifications.createInAppWithClient).toHaveBeenCalledWith(
      client,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'contract.payment.record' }),
    );
  });
});
