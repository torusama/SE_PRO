import { readFileSync } from 'fs';
import { join } from 'path';
describe('deceased family migration contract', () => {
  const sql = readFileSync(
    join(__dirname, '../database/migrations/023_deceased_family_schema.sql'),
    'utf8',
  );
  it('defines capacity without a default or capacity trigger', () => {
    expect(sql).toContain('deceased_profile_capacity SMALLINT');
    expect(sql).not.toMatch(/deceased_profile_capacity[^;]+DEFAULT/i);
    expect(sql).not.toContain('capacity_trigger');
  });
  it('defines all relationship uniqueness constraints', () => {
    for (const name of [
      'family_plots',
      'idx_family_plot_active_unique',
      'idx_family_member_active_unique',
      'idx_family_invite_pending_unique',
      'idx_resource_permission_active_unique',
    ])
      expect(sql).toContain(name);
  });
});
