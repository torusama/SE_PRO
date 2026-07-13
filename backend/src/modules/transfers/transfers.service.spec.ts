import { BadRequestException } from '@nestjs/common';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  const database = { query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn() } as any;
  const service = new TransfersService(database);

  beforeEach(() => jest.clearAllMocks());

  it('rejects unsupported search modes', async () => {
    await expect(service.search('legacy', 'A-01')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not query the database for a one-character keyword', async () => {
    await expect(service.search('plot', 'A')).resolves.toEqual([]);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('requires at least one contract document', async () => {
    await expect(service.transfer(1, {
      plotIds: [1],
      recipient: {
        fullName: 'Nguyen Van B',
        email: 'recipient@example.com',
        phone: '0900000000',
        idCard: '012345678901',
        address: 'Ha Noi',
      },
    }, [])).rejects.toThrow('Cần ít nhất một văn bản ảnh hoặc PDF');
    expect(database.transaction).not.toHaveBeenCalled();
  });
});

