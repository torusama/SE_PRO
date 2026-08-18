import { readFileSync } from 'fs';
import { join } from 'path';
describe('resource permission contract', () => {
  const migration = readFileSync(
    join(__dirname, '../database/migrations/027_deceased_family_schema.sql'),
    'utf8',
  );
  it.each([
    'view_profile',
    'view_plot',
    'view_service_history',
    'order_service',
  ])('supports %s without implication', (action) =>
    expect(migration).toContain(`'${action}'`),
  );
});
