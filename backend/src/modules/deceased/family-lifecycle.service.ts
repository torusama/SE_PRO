import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DeceasedAccessService } from './deceased-access.service';
import type { AuthUser } from './deceased.types';

@Injectable()
export class FamilyLifecycleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: DeceasedAccessService,
  ) {}

  disable(user: AuthUser, id: number) {
    return this.change(user, id, 'disabled', false);
  }
  enable(user: AuthUser, id: number) {
    return this.change(user, id, 'active', false);
  }
  remove(user: AuthUser, id: number) {
    return this.change(user, id, 'disabled', true);
  }

  private async change(
    user: AuthUser,
    id: number,
    status: 'active' | 'disabled',
    deleted: boolean,
  ) {
    return this.database.transaction(async (client) => {
      await this.access.assertFamilyManagerForLifecycle(user, id, client);
      const family = (
        await client.query(
          `SELECT * FROM family_groups WHERE family_id=$1 FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!family) throw new NotFoundException('Family not found');

      await client.query(
        `UPDATE family_groups
         SET status=$2,is_deleted=$3,
             disabled_at=CASE WHEN $2='disabled' THEN NOW() ELSE NULL END,
             disabled_by=CASE WHEN $2='disabled' THEN $4 ELSE NULL END,
             deleted_at=CASE WHEN $3 THEN NOW() ELSE NULL END,
             deleted_by=CASE WHEN $3 THEN $4 ELSE NULL END
         WHERE family_id=$1`,
        [id, status, deleted, user.id],
      );
      if (status === 'disabled' || deleted) {
        await client.query(
          `UPDATE family_invitations SET status='revoked',processed_at=NOW()
           WHERE family_id=$1 AND status='pending'`,
          [id],
        );
        await client.query(
          `UPDATE resource_permissions rp SET revoked_at=NOW(),revoked_by=$2
           FROM family_memberships fm
           WHERE rp.membership_id=fm.membership_id AND fm.family_id=$1
             AND rp.revoked_at IS NULL`,
          [id, user.id],
        );
      }
      await client.query(
        `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value)
         VALUES($1,$2,'family',$3,$4::jsonb,$5::jsonb)`,
        [
          user.id,
          deleted ? 'family.delete' : `family.${status}`,
          id,
          JSON.stringify({
            status: family.status,
            isDeleted: family.is_deleted,
          }),
          JSON.stringify({ status, isDeleted: deleted }),
        ],
      );
      return { id, status, isDeleted: deleted };
    });
  }
}
