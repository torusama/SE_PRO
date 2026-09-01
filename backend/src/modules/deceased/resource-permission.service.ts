import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DeceasedAccessService } from './deceased-access.service';
import type { AuthUser } from './deceased.types';
import { GrantResourcePermissionDto } from './dto';

@Injectable()
export class ResourcePermissionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: DeceasedAccessService,
  ) {}
  async grant(
    user: AuthUser,
    familyId: number,
    dto: GrantResourcePermissionDto,
  ) {
    return this.database.transaction(async (client) => {
      if (this.access.isAdmin(user))
        throw new ForbiddenException(
          'Only the current plot owner can share permissions',
        );
      const member = (
        await client.query(
          `SELECT membership_id FROM family_memberships WHERE family_id=$1 AND user_id=$2 AND is_active=TRUE`,
          [familyId, dto.memberUserId],
        )
      ).rows[0];
      if (!member) throw new NotFoundException('Không tìm thấy thành viên');
      // Chỉ hỗ trợ chia sẻ hồ sơ tưởng niệm — dùng chung logic xác định
      // quyền sở hữu với phần còn lại của module (đúng cho cả hồ sơ gắn lô
      // trong nghĩa trang lẫn hồ sơ "ngoài nghĩa trang").
      const profile = (
        await client.query(
          `SELECT plot_id, is_external_plot, created_by FROM deceased_profiles
           WHERE deceased_profile_id=$1 AND is_deleted=FALSE FOR UPDATE`,
          [dto.resourceId],
        )
      ).rows[0];
      if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ');
      await this.access.assertProfileOwner(user, profile, client);
      try {
        const result = await client.query(
          `INSERT INTO resource_permissions(membership_id,resource_type,resource_id,action,granted_by)
       VALUES($1,'deceased_profile',$2,$3,$4) RETURNING permission_id AS id`,
          [member.membership_id, dto.resourceId, dto.action, user.id],
        );
        await this.audit(
          client,
          user.id,
          'resource_permission.grant',
          result.rows[0].id,
          null,
          dto,
        );
        return result.rows[0];
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ConflictException('Quyền đã được cấp');
        throw error;
      }
    });
  }
  async revoke(user: AuthUser, familyId: number, id: number) {
    return this.database.transaction(async (client) => {
      if (this.access.isAdmin(user))
        throw new ForbiddenException(
          'Only the current plot owner can revoke permissions',
        );
      const row = (
        await client.query(
          `SELECT rp.*,fm.family_id FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id WHERE rp.permission_id=$1 AND fm.family_id=$2 FOR UPDATE`,
          [id, familyId],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy quyền');
      if (row.resource_type === 'deceased_profile') {
        const profile = (
          await client.query(
            `SELECT plot_id, is_external_plot, created_by FROM deceased_profiles WHERE deceased_profile_id=$1`,
            [row.resource_id],
          )
        ).rows[0];
        if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ');
        await this.access.assertProfileOwner(user, profile, client);
      } else {
        // Dữ liệu cũ (trước khi thu gọn chỉ còn chia sẻ hồ sơ tưởng niệm) —
        // vẫn giữ đường xác thực cũ để không chặn việc thu hồi các quyền cũ.
        const plotId = await this.resolvePlot(
          row.resource_type,
          row.resource_id,
          client,
        );
        await this.access.assertPlotOwner(user, plotId, client);
      }
      if (!row.revoked_at)
        await client.query(
          `UPDATE resource_permissions SET revoked_at=NOW(),revoked_by=$2 WHERE permission_id=$1`,
          [id, user.id],
        );
      await this.audit(client, user.id, 'resource_permission.revoke', id, row, {
        revoked: true,
      });
      return { id, revoked: true };
    });
  }
  async list(user: AuthUser, familyId: number) {
    await this.access.assertFamilyManager(user, familyId);
    return this.database.query(
      `SELECT rp.permission_id AS id,fm.user_id AS "userId",rp.resource_type AS "resourceType",rp.resource_id AS "resourceId",rp.action,rp.created_at AS "createdAt" FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id WHERE fm.family_id=$1 AND rp.revoked_at IS NULL`,
      [familyId],
    );
  }
  private async resolvePlot(
    type: string,
    id: number,
    client: import('pg').PoolClient,
  ) {
    const table =
      type === 'plot'
        ? 'plots'
        : type === 'deceased_profile'
          ? 'deceased_profiles'
          : 'service_orders';
    const key =
      type === 'plot'
        ? 'plot_id'
        : type === 'deceased_profile'
          ? 'deceased_profile_id'
          : 'order_id';
    const row = (
      await client.query(
        `SELECT plot_id FROM ${table} WHERE ${key}=$1 ${type === 'plot' ? 'AND is_deleted=FALSE' : 'AND is_deleted=FALSE'}`,
        [id],
      )
    ).rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy tài nguyên');
    return Number(row.plot_id);
  }
  private audit(
    client: import('pg').PoolClient,
    userId: number,
    action: string,
    id: number,
    before: unknown,
    after: unknown,
  ) {
    return client.query(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value)VALUES($1,$2,'resource_permission',$3,$4::jsonb,$5::jsonb)`,
      [userId, action, id, JSON.stringify(before), JSON.stringify(after)],
    );
  }
}
