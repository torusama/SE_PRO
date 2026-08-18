import { readFileSync } from 'fs';
import { join } from 'path';
describe('family invitation concurrency contract', () => {
  const source = readFileSync(
    join(__dirname, '../src/modules/deceased/family-invitation.service.ts'),
    'utf8',
  );
  it('locks invitation before one-time processing', () => {
    expect(source).toContain('FOR UPDATE OF fi');
    expect(source).toContain("invite.status !== 'pending'");
    expect(source).toContain('family_memberships');
  });
});
