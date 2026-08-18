import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type {
  AuthUser,
  PermissionAction,
  ResourceType,
} from './deceased.types';

@Injectable()
export class DeceasedAccessService {
  constructor(private readonly database: DatabaseService) {}

  isAdmin(user: AuthUser) {
    return user.role.toLowerCase() === 'admin';
  }

  async assertPlotOwner(user: AuthUser, plotId: number, client?: PoolClient) {
    if (this.isAdmin(user)) return;
    const sql = `SELECT 1 FROM ownership_records o
       JOIN plots p ON p.plot_id=o.plot_id
       WHERE o.user_id=$1 AND o.plot_id=$2 AND o.is_current=TRUE
         AND p.is_deleted=FALSE`;
    const found = client
      ? (await client.query(sql, [user.id, plotId])).rows[0]
      : (await this.database.query(sql, [user.id, plotId]))[0];
    if (!found) throw new NotFoundException('Không tìm thấy tài nguyên');
  }

  async can(
    user: AuthUser,
    resourceType: ResourceType,
    resourceId: number,
    action: PermissionAction,
  ) {
    if (this.isAdmin(user)) return true;
    const plotId = await this.resourcePlot(resourceType, resourceId);
    if (!plotId) return false;
    const owner = await this.database.queryOne(
      `SELECT 1 FROM ownership_records WHERE user_id=$1 AND plot_id=$2 AND is_current=TRUE`,
      [user.id, plotId],
    );
    if (owner) return true;
    const permission = await this.database.queryOne(
      `SELECT 1 FROM resource_permissions rp
       JOIN family_memberships fm ON fm.membership_id=rp.membership_id AND fm.is_active=TRUE
       JOIN family_groups fg ON fg.family_id=fm.family_id
         AND fg.status='active' AND fg.is_deleted=FALSE
       WHERE fm.user_id=$1 AND rp.resource_type=$2 AND rp.resource_id=$3
         AND rp.action=$4 AND rp.revoked_at IS NULL`,
      [user.id, resourceType, resourceId, action],
    );
    return Boolean(permission);
  }

  async assert(
    user: AuthUser,
    type: ResourceType,
    id: number,
    action: PermissionAction,
  ) {
    if (!(await this.can(user, type, id, action))) {
      throw new NotFoundException('Không tìm thấy tài nguyên');
    }
  }

  async assertFamilyManager(
    user: AuthUser,
    familyId: number,
    client?: PoolClient,
  ) {
    const sql = `SELECT 1 FROM family_memberships fm JOIN family_groups fg ON fg.family_id=fm.family_id
       WHERE fm.family_id=$1 AND fm.user_id=$2 AND fm.membership_role='manager'
         AND fm.is_active=TRUE AND fg.status='active' AND fg.is_deleted=FALSE`;
    const found = client
      ? (await client.query(sql, [familyId, user.id])).rows[0]
      : (await this.database.query(sql, [familyId, user.id]))[0];
    if (!found)
      throw new ForbiddenException('Bạn không có quyền quản lý gia đình');
  }

  async assertFamilyManagerForLifecycle(
    user: AuthUser,
    familyId: number,
    client: PoolClient,
  ) {
    const found = (
      await client.query(
        `SELECT 1 FROM family_memberships fm
       JOIN family_groups fg ON fg.family_id=fm.family_id
       WHERE fm.family_id=$1 AND fm.user_id=$2 AND fm.membership_role='manager'
         AND fm.is_active=TRUE AND fg.is_deleted=FALSE`,
        [familyId, user.id],
      )
    ).rows[0];
    if (!found)
      throw new ForbiddenException('Family manager permission required');
  }

  private async resourcePlot(
    type: ResourceType,
    id: number,
  ): Promise<number | null> {
    if (type === 'plot')
      return (
        (
          await this.database.queryOne<{ plot_id: number }>(
            `SELECT plot_id FROM plots WHERE plot_id=$1 AND is_deleted=FALSE`,
            [id],
          )
        )?.plot_id ?? null
      );
    if (type === 'deceased_profile')
      return (
        (
          await this.database.queryOne<{ plot_id: number }>(
            `SELECT plot_id FROM deceased_profiles WHERE deceased_profile_id=$1 AND is_deleted=FALSE`,
            [id],
          )
        )?.plot_id ?? null
      );
    return (
      (
        await this.database.queryOne<{ plot_id: number }>(
          `SELECT plot_id FROM service_orders WHERE order_id=$1 AND is_deleted=FALSE`,
          [id],
        )
      )?.plot_id ?? null
    );
  }
}
