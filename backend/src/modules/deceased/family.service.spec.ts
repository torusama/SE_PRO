import { BadRequestException } from '@nestjs/common';
import { FamilyService } from './family.service';
describe('FamilyService', () => {
  it('prevents self invitation', async () => {
    const database = { queryOne: jest.fn().mockResolvedValue({ id: 3 }) };
    const service = new FamilyService(database as never, {} as never);
    await expect(
      service.invite({ id: 3, role: 'customer' }, 1, 'owner@example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
