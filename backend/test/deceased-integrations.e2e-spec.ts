import { readFileSync } from 'fs';
import { join } from 'path';
describe('deceased integrations', () => {
  it('links reminders and service orders without cascade delete', () => {
    const sql = readFileSync(
      join(__dirname, '../database/migrations/023_deceased_family_schema.sql'),
      'utf8',
    );
    expect(
      sql.match(/deceased_profile_id INT REFERENCES deceased_profiles/g) ?? [],
    ).toHaveLength(2);
    expect(sql).toContain('ON DELETE RESTRICT');
  });
});
