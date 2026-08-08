import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DeceasedAccessService } from './deceased-access.service';
import type { AuthUser } from './deceased.types';
import { CreateFamilyDto } from './dto';

@Injectable()
export class FamilyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: DeceasedAccessService,
  ) {}
  async create(user: AuthUser, dto: CreateFamilyDto) {
    const owns = await this.database.queryOne(
      `SELECT 1 FROM ownership_records WHERE user_id=$1 AND is_current=TRUE`,
      [user.id],
    );
    if (!owns && !this.access.isAdmin(user))
      throw new NotFoundException('Không tìm thấy tài nguyên');
    return this.database.transaction(async (client) => {
      const family = (
        await client.query(
          `INSERT INTO family_groups(name,created_by)VALUES($1,$2)RETURNING family_id AS id,name,status`,
          [dto.name.trim(), user.id],
        )
      ).rows[0];
      await client.query(
        `INSERT INTO family_memberships(family_id,user_id,membership_role)VALUES($1,$2,'manager')`,
        [family.id, user.id],
      );
      await this.audit(client, user.id, 'family.create', family.id, {
        name: dto.name,
      });
      return family;
    });
  }
  list(userId: number) {
    return this.database.query(
      `SELECT fg.family_id AS id,fg.name,fg.status,fg.is_deleted AS "isDeleted",fm.membership_role AS role FROM family_groups fg JOIN family_memberships fm ON fm.family_id=fg.family_id AND fm.is_active=TRUE WHERE fm.user_id=$1 AND fg.is_deleted=FALSE ORDER BY fg.created_at DESC`,
      [userId],
    );
  }
  async addPlot(user: AuthUser, familyId: number, plotId: number) {
    return this.database.transaction(async (client) => {
      await this.access.assertFamilyManager(user, familyId, client);
      await this.access.assertPlotOwner(user, plotId, client);
      try {
        const row = (
          await client.query(
            `INSERT INTO family_plots(family_id,plot_id,linked_by)VALUES($1,$2,$3)RETURNING family_plot_id AS id`,
            [familyId, plotId, user.id],
          )
        ).rows[0];
        await this.audit(client, user.id, 'family.plot.add', familyId, {
          plotId,
        });
        return row;
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ConflictException('Lô đã thuộc gia đình');
        throw error;
      }
    });
  }
  async plots(user: AuthUser, familyId: number) {
    await this.access.assertFamilyManager(user, familyId);
    return this.database.query(
      `SELECT p.plot_id AS id,p.plot_code AS "plotCode",p.status FROM family_plots fp JOIN plots p ON p.plot_id=fp.plot_id WHERE fp.family_id=$1 AND fp.is_active=TRUE AND p.is_deleted=FALSE`,
      [familyId],
    );
  }
  async removePlot(user: AuthUser, familyId: number, plotId: number) {
    return this.database.transaction(async (client) => {
      await this.access.assertFamilyManager(user, familyId, client);
      await this.access.assertPlotOwner(user, plotId, client);
      const row = (
        await client.query(
          `UPDATE family_plots SET is_active=FALSE,unlinked_at=NOW() WHERE family_id=$1 AND plot_id=$2 AND is_active=TRUE RETURNING family_plot_id`,
          [familyId, plotId],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy lô trong gia đình');
      await this.audit(client, user.id, 'family.plot.remove', familyId, {
        plotId,
      });
      return { removed: true };
    });
  }
  async invite(user: AuthUser, familyId: number, inviteeId: number) {
    if (user.id === inviteeId)
      throw new BadRequestException('Không thể tự mời chính mình');
    return this.database.transaction(async (client) => {
      await this.access.assertFamilyManager(user, familyId, client);
      const active = (
        await client.query(
          `SELECT 1 FROM users WHERE user_id=$1 AND is_active=TRUE AND is_deleted=FALSE`,
          [inviteeId],
        )
      ).rows[0];
      if (!active) throw new NotFoundException('Không tìm thấy người dùng');
      const member = (
        await client.query(
          `SELECT 1 FROM family_memberships WHERE family_id=$1 AND user_id=$2 AND is_active=TRUE`,
          [familyId, inviteeId],
        )
      ).rows[0];
      if (member) throw new ConflictException('Người dùng đã là thành viên');
      try {
        const row = (
          await client.query(
            `INSERT INTO family_invitations(family_id,inviter_user_id,invitee_user_id,expires_at)VALUES($1,$2,$3,NOW()+INTERVAL '7 days')RETURNING invitation_id AS id,status,expires_at AS "expiresAt"`,
            [familyId, user.id, inviteeId],
          )
        ).rows[0];
        await this.audit(client, user.id, 'family.invitation.create', row.id, {
          familyId,
          inviteeId,
        });
        return row;
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new ConflictException('Lời mời đang chờ xử lý');
        throw error;
      }
    });
  }
  invitations(userId: number) {
    return this.database.query(
      `SELECT fi.invitation_id AS id,fi.family_id AS "familyId",fg.name AS "familyName",fi.status,fi.expires_at AS "expiresAt" FROM family_invitations fi JOIN family_groups fg ON fg.family_id=fi.family_id WHERE fi.invitee_user_id=$1 ORDER BY fi.created_at DESC`,
      [userId],
    );
  }
  async removeMember(user: AuthUser, familyId: number, userId: number) {
    return this.database.transaction(async (client) => {
      await this.access.assertFamilyManager(user, familyId, client);
      const member = (
        await client.query(
          `UPDATE family_memberships SET is_active=FALSE,removed_at=NOW(),removed_by=$3 WHERE family_id=$1 AND user_id=$2 AND is_active=TRUE AND membership_role<>'manager' RETURNING membership_id`,
          [familyId, userId, user.id],
        )
      ).rows[0];
      if (!member) throw new NotFoundException('Không tìm thấy thành viên');
      await client.query(
        `UPDATE resource_permissions SET revoked_at=NOW(),revoked_by=$2 WHERE membership_id=$1 AND revoked_at IS NULL`,
        [member.membership_id, user.id],
      );
      await this.audit(client, user.id, 'family.member.remove', familyId, {
        userId,
      });
      return { removed: true };
    });
  }
  private audit(
    client: import('pg').PoolClient,
    userId: number,
    action: string,
    id: number,
    after: unknown,
  ) {
    return client.query(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value)VALUES($1,$2,'family',$3,$4::jsonb)`,
      [userId, action, id, JSON.stringify(after)],
    );
  }
}
