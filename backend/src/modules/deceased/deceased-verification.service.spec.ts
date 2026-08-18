import { BadRequestException } from '@nestjs/common';
import { DeceasedVerificationService } from './deceased-verification.service';
describe('DeceasedVerificationService', () => {
  it('rejects a second verification', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValue({ rows: [{ verification_status: 'verified' }] }),
    };
    const database = {
      transaction: jest.fn((cb: (value: typeof client) => unknown) =>
        Promise.resolve(cb(client)),
      ),
    };
    const service = new DeceasedVerificationService(database as never);
    await expect(service.verify(1, 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
