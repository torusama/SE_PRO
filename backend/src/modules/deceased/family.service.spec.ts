import { BadRequestException } from '@nestjs/common';
import { FamilyService } from './family.service';
describe('FamilyService', () => {
  it('prevents self invitation', async () => {
    const service = new FamilyService({} as never, {} as never);
    await expect(
      service.invite({ id: 3, role: 'customer' }, 1, 3),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
