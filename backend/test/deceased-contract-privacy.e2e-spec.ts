import { readFileSync } from 'fs';
import { join } from 'path';
describe('deceased privacy contract', () => {
  it('does not expose ownership/deceased data in public plot detail', () => {
    const source = readFileSync(
      join(__dirname, '../src/modules/plots/plots.service.ts'),
      'utf8',
    );
    const method = source.slice(
      source.indexOf('async findOne'),
      source.indexOf('async create(', source.indexOf('async findOne')),
    );
    expect(method).not.toContain('owner_phone');
    expect(method).not.toContain('owner_name');
    expect(method).not.toContain('deceased_name');
  });
});
