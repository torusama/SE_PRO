import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminListQueryDto } from './admin-list-query.dto';

describe('AdminListQueryDto', () => {
  it('transforms and accepts bounded pagination', async () => {
    const dto = plainToInstance(AdminListQueryDto, {
      page: '2',
      pageSize: '50',
      search: '  ABC  ',
      sortOrder: 'asc',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(50);
    expect(dto.search).toBe('ABC');
    expect(dto.offset).toBe(50);
  });

  it('defaults page values and rejects page sizes above 100', async () => {
    const defaults = plainToInstance(AdminListQueryDto, {});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(20);

    const invalid = plainToInstance(AdminListQueryDto, { pageSize: '101' });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
