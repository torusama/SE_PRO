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
    transaction: jest.fn((callback: (value: typeof client) => unknown) =>
      Promise.resolve(callback(client)),
    ),
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
    service: new ContractsService(
      database as never,
      notifications as never,
      audit as never,
    ),
  };
}

describe('ContractsService admin operations', () => {
  it('allows an unsigned legacy active contract to adopt the new inheritance template', async () => {
    const legacyBase =
      'ĐIỀU 1. ĐỐI TƯỢNG\nNội dung\n\nĐIỀU 3. QUYỀN VÀ NGHĨA VỤ\nGiữ nguyên\n\nĐIỀU 6. THÔNG TIN CŨ\n[ĐỂ TRỐNG - CHỈ ADMIN CẬP NHẬT]';
    const { client, service } = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-1',
              userId: 2,
              status: 'active',
              contractContent: legacyBase,
              contractBaseContent: null,
              inheritanceContent: null,
              partyASignedAt: null,
              partyBSignedAt: null,
              hasSignedEvidence: false,
            },
          ],
        };
      }
      if (sql.includes('UPDATE contracts')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-1',
              userId: 2,
              inheritanceContent: 'Nội dung mới',
            },
          ],
        };
      }
      if (sql.includes('FROM contract_plots cp')) {
        return {
          rows: [
            {
              code: 'A-01',
              zoneName: 'Khu A',
              areaSqm: 5,
              price: 12000000,
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.updateInheritance(1, 'Nội dung mới', 9),
    ).resolves.toMatchObject({ inheritanceContent: 'Nội dung mới' });
    const updateCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE contracts'),
    );
    expect(updateCall?.[1]?.[3]).not.toContain('CHỈ ADMIN CẬP NHẬT');
    expect(updateCall?.[1]?.[3]).toContain('1. Lô A-01');
    expect(updateCall?.[1]?.[4]).toContain('Nội dung mới');
  });

  it('keeps an active contract locked after signed evidence is recorded', async () => {
    const { service } = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              status: 'active',
              hasSignedEvidence: true,
              partyASignedAt: null,
              partyBSignedAt: null,
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.updateInheritance(1, 'Không được sửa', 9),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

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
        return {
          rows: [
            {
              id: 1,
              totalAmount: 100,
              paidAmount: 90,
              paymentStatus: 'partial',
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });
    await expect(
      over.service.addPayment(1, { amount: 20, paymentMethod: 'cash' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    const duplicate = setup((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return {
          rows: [
            { id: 1, totalAmount: 100, paidAmount: 0, paymentStatus: 'unpaid' },
          ],
        };
      }
      if (sql.includes('SELECT 1 FROM payment_transactions'))
        return { rows: [{ exists: 1 }] };
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
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-1',
              userId: 2,
              totalAmount: 100,
              paidAmount: 0,
              paymentStatus: 'unpaid',
              status: 'draft',
              generatedPdfAt: new Date(),
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO payment_transactions')) {
        return { rows: [{ id: 8, amount: 100, paymentMethod: 'cash' }] };
      }
      if (sql.includes('FROM contracts') && !sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-1',
              userId: 2,
              totalAmount: 100,
              paidAmount: 100,
              paymentStatus: 'paid',
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });
    await service.addPayment(1, { amount: 100, paymentMethod: 'cash' }, 9);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('SET paid_amount = paid_amount +'),
      expect.anything(),
    );
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

  it('rejects ownership activation until the contract is fully paid', async () => {
    const { service } = setup((sql) => {
      if (sql.includes('FROM contracts') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-2026-10',
              userId: 7,
              status: 'draft',
              paymentStatus: 'partial',
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.activateOwnership(1, 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires signed evidence after the contract is fully paid', async () => {
    const { service } = setup((sql) => {
      if (sql.includes('FROM contracts') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-2026-10',
              userId: 7,
              status: 'draft',
              paymentStatus: 'paid',
              generatedPdfAt: new Date(),
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.activateOwnership(1, 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('activates one contract and creates ownership for all included plots', async () => {
    const { client, notifications, audit, service } = setup((sql) => {
      if (sql.includes('FROM contracts') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              id: 1,
              contractCode: 'HD-2026-10',
              userId: 7,
              status: 'draft',
              paymentStatus: 'paid',
              generatedPdfAt: new Date(),
            },
          ],
        };
      }
      if (sql.includes('FROM contract_signed_evidence')) {
        return { rows: [{ evidence_id: 3 }] };
      }
      if (sql.includes('FROM contract_plots') && sql.includes('FOR UPDATE')) {
        return {
          rows: [
            { id: 11, code: 'A-01-001', status: 'reserved' },
            { id: 12, code: 'A-01-002', status: 'reserved' },
          ],
        };
      }
      if (sql.includes('FROM ownership_records') && sql.includes('ANY')) {
        return { rows: [] };
      }
      if (sql.includes("SET status = 'active'")) {
        return { rows: [{ id: 1, contractCode: 'HD-2026-10', status: 'active' }] };
      }
      if (sql.includes('COUNT(*)::int') && sql.includes('ownership_records')) {
        return { rows: [{ total: 2 }] };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(service.activateOwnership(1, 9)).resolves.toMatchObject({
      status: 'active',
      ownershipCreated: 2,
      plotCodes: ['A-01-001', 'A-01-002'],
    });
    expect(notifications.createInAppWithClient).toHaveBeenCalledWith(
      client,
      7,
      'ownership_activated',
      expect.any(String),
      expect.stringContaining('2 lô'),
      'contract',
      1,
    );
    expect(audit.record).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'contract.ownership.activate' }),
    );
  });
});
