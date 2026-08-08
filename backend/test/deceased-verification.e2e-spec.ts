import { readFileSync } from 'fs';
import { join } from 'path';
describe('deceased verification contract', () => {
  const source = readFileSync(
    join(__dirname, '../src/modules/deceased/deceased-admin.controller.ts'),
    'utf8',
  );
  it('requires admin and exposes verify/reject', () => {
    expect(source).toContain("@Roles('admin')");
    expect(source).toContain('deceased/:id/verify');
    expect(source).toContain('deceased/:id/reject');
  });
});
