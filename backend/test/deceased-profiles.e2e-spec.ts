import { readFileSync } from 'fs';
import { join } from 'path';
describe('deceased profile API contract', () => {
  const source = readFileSync(
    join(__dirname, '../src/modules/deceased/deceased.controller.ts'),
    'utf8',
  );
  it('exposes guarded lifecycle routes', () => {
    for (const route of [
      '@Post()',
      "@Get(':id')",
      "@Patch(':id')",
      "@Delete(':id')",
      "@Post(':id/restore')",
    ])
      expect(source).toContain(route);
    expect(source).toContain('@UseGuards(JwtAuthGuard)');
  });
});
