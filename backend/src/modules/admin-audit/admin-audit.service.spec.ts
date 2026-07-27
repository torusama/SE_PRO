import { AdminAuditService, redactAuditValue } from './admin-audit.service';

describe('AdminAuditService', () => {
  it('redacts nested secrets and protected identity values', () => {
    expect(
      redactAuditValue({
        name: 'An',
        passwordHash: 'hash',
        nested: { otpCode: '123456', idCardNumber: '012345678901' },
      }),
    ).toEqual({
      name: 'An',
      passwordHash: '[REDACTED]',
      nested: { otpCode: '[REDACTED]', idCardNumber: '[REDACTED]' },
    });
  });

  it('persists integer and UUID entity identifiers', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 3 }] }),
    };
    const service = new AdminAuditService({} as never);
    await expect(
      service.record(client as never, {
        action: 'transfer.completed',
        entityType: 'transfer_batch',
        entityId: null,
        entityKey: '0c081f79-42cb-43ee-9a90-8399407ba594',
        before: { token: 'secret' },
        after: { plotCount: 2 },
        context: { adminId: 1, ipAddress: '127.0.0.1', userAgent: 'jest' },
      }),
    ).resolves.toEqual({ id: 3 });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('entity_key'),
      expect.arrayContaining([
        1,
        'transfer.completed',
        'transfer_batch',
        null,
        '0c081f79-42cb-43ee-9a90-8399407ba594',
      ]),
    );
  });

  it('applies search, type, actor and date filters with stable pagination', async () => {
    const database = {
      queryOne: jest.fn().mockResolvedValue({ total: '1' }),
      query: jest.fn().mockResolvedValue([{ id: 7, before: { token: '[REDACTED]' } }]),
    };
    const service = new AdminAuditService(database as never);
    await expect(
      service.list({
        page: 2,
        pageSize: 10,
        offset: 10,
        search: 'payment',
        action: 'contract.payment.record',
        entityType: 'contract',
        actorId: 1,
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-31T23:59:59.000Z',
      } as never),
    ).resolves.toMatchObject({ total: 1, page: 2, items: [{ id: 7 }] });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY a.created_at DESC, a.log_id DESC'),
      expect.arrayContaining([
        '%payment%',
        'contract.payment.record',
        'contract',
        1,
        '2026-07-01T00:00:00.000Z',
        '2026-07-31T23:59:59.000Z',
        10,
        10,
      ]),
    );
  });
});
