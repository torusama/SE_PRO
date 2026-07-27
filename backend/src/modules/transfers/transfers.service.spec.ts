import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  const database = {
    query: jest.fn(),
    queryOne: jest.fn(),
    transaction: jest.fn(),
  } as any;
  const service = new TransfersService(database);

  beforeEach(() => jest.clearAllMocks());

  it('rejects unsupported search modes', async () => {
    await expect(service.search('legacy', 'A-01')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not query the database for a one-character keyword', async () => {
    await expect(service.search('plot', 'A')).resolves.toEqual([]);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('requires at least one contract document', async () => {
    await expect(
      service.transfer(
        1,
        {
          plotIds: [1],
          recipient: {
            fullName: 'Nguyen Van B',
            email: 'recipient@example.com',
            phone: '0900000000',
            idCard: '012345678901',
            address: 'Ha Noi',
          },
        },
        [],
      ),
    ).rejects.toThrow('Cần ít nhất một văn bản ảnh hoặc PDF');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('paginates current and historical ownership', async () => {
    database.queryOne.mockResolvedValue({ total: '1' });
    database.query.mockResolvedValue([{ id: 5, isCurrent: true }]);
    await expect(
      service.ownership({
        page: 1,
        pageSize: 20,
        offset: 0,
        currentOnly: true,
        search: 'A-01',
      } as never),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 5 }] });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('o.is_current=TRUE'),
      ['%A-01%', 20, 0],
    );
  });

  it('returns transfer batch detail with items and documents', async () => {
    database.queryOne.mockResolvedValue({ id: 'batch-uuid' });
    database.query
      .mockResolvedValueOnce([{ id: 'item-uuid' }])
      .mockResolvedValueOnce([{ id: 'document-uuid' }]);
    await expect(service.transferDetail('batch-uuid')).resolves.toMatchObject({
      items: [{ id: 'item-uuid' }],
      documents: [{ id: 'document-uuid' }],
    });
  });

  it('writes UUID entity_key audit inside the transfer transaction', async () => {
    const filePath = join(tmpdir(), `transfer-${Date.now()}.pdf`);
    await fs.writeFile(filePath, 'test document');
    const client = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM ownership_records o')) {
          return Promise.resolve({
            rows: [{
              ownership_id: 1,
              plot_id: 2,
              contract_id: 3,
              user_id: 4,
              full_name: 'Chủ cũ',
              plot_code: 'A-01',
            }],
          });
        }
        if (sql.includes('SELECT user_id FROM users')) {
          return Promise.resolve({ rows: [{ user_id: 5 }] });
        }
        if (sql.includes('LPAD')) return Promise.resolve({ rows: [{ value: '000001' }] });
        if (sql.includes('RETURNING contract_id')) return Promise.resolve({ rows: [{ contract_id: 6 }] });
        if (sql.includes('SELECT ownership_id FROM ownership_records')) {
          return Promise.resolve({ rows: [{ ownership_id: 7 }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
    };
    database.transaction.mockImplementation(async (callback: any) => callback(client));
    const transferred = await service.transfer(
      9,
      {
        plotIds: [2],
        recipient: {
          fullName: 'Chủ mới',
          email: 'new@example.com',
          phone: '0900000000',
          idCard: '012345678901',
          address: 'Hà Nội',
        },
      },
      [{
        path: filePath,
        filename: 'transfer.pdf',
        originalname: 'transfer.pdf',
        mimetype: 'application/pdf',
        size: 13,
      }] as Express.Multer.File[],
      { adminId: 9, ipAddress: '127.0.0.1', userAgent: 'jest' },
    );
    expect(transferred.id).toEqual(expect.any(String));
    const auditCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("'admin_plot_transfer_completed'"),
    );
    expect(auditCall?.[0]).toContain('entity_key');
    expect(auditCall?.[1]?.[1]).toBe(transferred.id);
    await fs.unlink(filePath);
  });

  it('propagates transaction failure and removes uploaded temporary files', async () => {
    const filePath = join(tmpdir(), `transfer-rollback-${Date.now()}.pdf`);
    await fs.writeFile(filePath, 'rollback');
    database.transaction.mockRejectedValue(new Error('transaction failed'));
    await expect(
      service.transfer(
        9,
        {
          plotIds: [2],
          recipient: {
            fullName: 'Chủ mới',
            email: 'new@example.com',
            phone: '0900000000',
            idCard: '012345678901',
            address: 'Hà Nội',
          },
        },
        [{ path: filePath }] as Express.Multer.File[],
      ),
    ).rejects.toThrow('transaction failed');
    await expect(fs.access(filePath)).rejects.toBeDefined();
  });
});
