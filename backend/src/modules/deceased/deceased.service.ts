import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { DeceasedAccessService } from './deceased-access.service';
import type { AuthUser } from './deceased.types';
import {
  CreateDeceasedProfileDto,
  DeceasedProfileQueryDto,
  UpdateDeceasedProfileDto,
} from './dto';

const PROFILE_SELECT = `dp.deceased_profile_id AS id, dp.plot_id AS "plotId", p.plot_code AS "plotCode",
 dp.full_name AS "fullName", dp.date_of_birth AS "dateOfBirth", dp.date_of_death AS "dateOfDeath",
 dp.burial_date AS "burialDate", dp.avatar_url AS "avatarUrl", dp.hometown, dp.biography,
 dp.anniversary_month AS "anniversaryMonth", dp.anniversary_day AS "anniversaryDay",
 dp.verification_status AS "verificationStatus", dp.rejection_reason AS "rejectionReason",
 dp.is_deleted AS "isDeleted", dp.created_at AS "createdAt", dp.updated_at AS "updatedAt"`;

@Injectable()
export class DeceasedService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: DeceasedAccessService,
  ) {}

  async create(user: AuthUser, dto: CreateDeceasedProfileDto) {
    this.validateDates(dto);
    return this.database.transaction(async (client) => {
      await this.access.assertPlotOwner(user, dto.plotId, client);
      await this.assertCapacity(client, dto.plotId);
      const result = await client.query(
        `INSERT INTO deceased_profiles
         (plot_id,full_name,date_of_birth,date_of_death,burial_date,avatar_url,hometown,biography,
          anniversary_month,anniversary_day,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING deceased_profile_id AS id`,
        [
          dto.plotId,
          dto.fullName.trim(),
          dto.dateOfBirth ?? null,
          dto.dateOfDeath ?? null,
          dto.burialDate ?? null,
          dto.avatarUrl ?? null,
          dto.hometown?.trim() || null,
          dto.biography?.trim() || null,
          dto.anniversaryMonth ?? null,
          dto.anniversaryDay ?? null,
          user.id,
        ],
      );
      await this.audit(
        client,
        user.id,
        'deceased_profile.create',
        result.rows[0].id,
        null,
        dto,
      );
      return result.rows[0];
    });
  }

  async findOne(user: AuthUser, id: number, includeDeleted = false) {
    if (!this.access.isAdmin(user))
      await this.access.assert(user, 'deceased_profile', id, 'view_profile');
    const row = await this.database.queryOne(
      `SELECT ${PROFILE_SELECT} FROM deceased_profiles dp JOIN plots p ON p.plot_id=dp.plot_id
       WHERE dp.deceased_profile_id=$1 ${includeDeleted ? '' : 'AND dp.is_deleted=FALSE'}`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ');
    return row;
  }

  async list(user: AuthUser, query: DeceasedProfileQueryDto, admin = false) {
    const values: unknown[] = [];
    const add = (v: unknown) => {
      values.push(v);
      return `$${values.length}`;
    };
    const conditions = ['dp.is_deleted=FALSE'];
    if (!admin) {
      const uid = add(user.id);
      conditions.push(`(EXISTS(SELECT 1 FROM ownership_records o WHERE o.plot_id=dp.plot_id AND o.user_id=${uid} AND o.is_current=TRUE)
        OR EXISTS(SELECT 1 FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id AND fm.is_active=TRUE
          JOIN family_groups fg ON fg.family_id=fm.family_id AND fg.status='active' AND fg.is_deleted=FALSE
          WHERE fm.user_id=${uid} AND rp.resource_type='deceased_profile' AND rp.resource_id=dp.deceased_profile_id
            AND rp.action='view_profile' AND rp.revoked_at IS NULL))`);
    }
    if (query.search)
      conditions.push(`dp.full_name ILIKE ${add(`%${query.search}%`)}`);
    if (query.plotId) conditions.push(`dp.plot_id=${add(query.plotId)}`);
    if (query.verificationStatus)
      conditions.push(
        `dp.verification_status=${add(query.verificationStatus)}`,
      );
    if (query.familyId)
      conditions.push(
        `EXISTS(SELECT 1 FROM family_plots fp WHERE fp.family_id=${add(query.familyId)} AND fp.plot_id=dp.plot_id AND fp.is_active=TRUE)`,
      );
    const where = `WHERE ${conditions.join(' AND ')}`;
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text total FROM deceased_profiles dp ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.database.query(
      `SELECT ${PROFILE_SELECT} FROM deceased_profiles dp JOIN plots p ON p.plot_id=dp.plot_id ${where}
      ORDER BY dp.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async update(user: AuthUser, id: number, dto: UpdateDeceasedProfileDto) {
    return this.database.transaction(async (client) => {
      const current = (
        await client.query(
          `SELECT * FROM deceased_profiles WHERE deceased_profile_id=$1 AND is_deleted=FALSE FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy hồ sơ');
      this.validateDates({
        dateOfBirth: dto.dateOfBirth ?? current.date_of_birth,
        dateOfDeath: dto.dateOfDeath ?? current.date_of_death,
        burialDate: dto.burialDate ?? current.burial_date,
        anniversaryMonth: dto.anniversaryMonth ?? current.anniversary_month,
        anniversaryDay: dto.anniversaryDay ?? current.anniversary_day,
      });
      await this.access.assertPlotOwner(user, current.plot_id, client);
      const plotId = dto.plotId ?? current.plot_id;
      if (plotId !== current.plot_id) {
        await this.access.assertPlotOwner(user, plotId, client);
        await this.assertCapacity(client, plotId);
      }
      const critical =
        dto.fullName !== undefined ||
        dto.dateOfBirth !== undefined ||
        dto.dateOfDeath !== undefined ||
        dto.burialDate !== undefined;
      await client.query(
        `UPDATE deceased_profiles SET plot_id=$2,full_name=COALESCE($3,full_name),date_of_birth=COALESCE($4,date_of_birth),
       date_of_death=COALESCE($5,date_of_death),burial_date=COALESCE($6,burial_date),avatar_url=COALESCE($7,avatar_url),
       hometown=COALESCE($8,hometown),biography=COALESCE($9,biography),anniversary_month=COALESCE($10,anniversary_month),
       anniversary_day=COALESCE($11,anniversary_day),verification_status=CASE WHEN verification_status='verified' AND $12 THEN 'pending_verification' ELSE verification_status END,
       rejection_reason=CASE WHEN $12 THEN NULL ELSE rejection_reason END WHERE deceased_profile_id=$1`,
        [
          id,
          plotId,
          dto.fullName?.trim() ?? null,
          dto.dateOfBirth ?? null,
          dto.dateOfDeath ?? null,
          dto.burialDate ?? null,
          dto.avatarUrl ?? null,
          dto.hometown ?? null,
          dto.biography ?? null,
          dto.anniversaryMonth ?? null,
          dto.anniversaryDay ?? null,
          critical,
        ],
      );
      await this.audit(
        client,
        user.id,
        'deceased_profile.update',
        id,
        current,
        dto,
      );
      return { id };
    });
  }

  async remove(user: AuthUser, id: number) {
    return this.softState(user, id, true);
  }
  async restore(user: AuthUser, id: number) {
    return this.softState(user, id, false);
  }
  async configureCapacity(id: number, capacity: number, adminId: number) {
    return this.database.transaction(async (client) => {
      const row = (
        await client.query(
          `SELECT plot_id FROM plots WHERE plot_id=$1 AND is_deleted=FALSE FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy lô');
      const count = Number(
        (
          await client.query(
            `SELECT COUNT(*)::int count FROM deceased_profiles WHERE plot_id=$1 AND is_deleted=FALSE`,
            [id],
          )
        ).rows[0].count,
      );
      if (capacity < count)
        throw new ConflictException('Capacity nhỏ hơn số hồ sơ hiện có');
      await client.query(
        `UPDATE plots SET deceased_profile_capacity=$2,updated_at=NOW() WHERE plot_id=$1`,
        [id, capacity],
      );
      await this.audit(
        client,
        adminId,
        'plot.deceased_capacity.update',
        id,
        null,
        { capacity },
      );
      return { id, capacity };
    });
  }

  private async softState(user: AuthUser, id: number, deleted: boolean) {
    return this.database.transaction(async (client) => {
      const row = (
        await client.query(
          `SELECT * FROM deceased_profiles WHERE deceased_profile_id=$1 FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!row || row.is_deleted === deleted)
        throw new NotFoundException('Không tìm thấy hồ sơ');
      await this.access.assertPlotOwner(user, row.plot_id, client);
      if (!deleted) await this.assertCapacity(client, row.plot_id);
      await client.query(
        `UPDATE deceased_profiles SET is_deleted=$2,deleted_at=CASE WHEN $2 THEN NOW() ELSE NULL END,deleted_by=CASE WHEN $2 THEN $3 ELSE NULL END WHERE deceased_profile_id=$1`,
        [id, deleted, user.id],
      );
      await this.audit(
        client,
        user.id,
        deleted ? 'deceased_profile.delete' : 'deceased_profile.restore',
        id,
        row,
        { isDeleted: deleted },
      );
      return { id, isDeleted: deleted };
    });
  }
  private async assertCapacity(client: PoolClient, plotId: number) {
    const plot = (
      await client.query(
        `SELECT deceased_profile_capacity FROM plots WHERE plot_id=$1 AND is_deleted=FALSE AND status<>'locked' FOR UPDATE`,
        [plotId],
      )
    ).rows[0];
    if (!plot) throw new NotFoundException('Không tìm thấy lô');
    const capacity = Number(plot.deceased_profile_capacity ?? 1);
    const count = Number(
      (
        await client.query(
          `SELECT COUNT(*)::int count FROM deceased_profiles WHERE plot_id=$1 AND is_deleted=FALSE`,
          [plotId],
        )
      ).rows[0].count,
    );
    if (count >= capacity)
      throw new ConflictException('Lô đã đạt capacity');
  }
  private validateDates(dto: Partial<CreateDeceasedProfileDto>) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (dto.dateOfBirth && dto.dateOfBirth > today)
      throw new BadRequestException('Ngày sinh không được sau ngày hiện tại');
    if (dto.dateOfDeath && dto.dateOfDeath > today)
      throw new BadRequestException('Ngày mất không được sau ngày hiện tại');
    if (dto.burialDate && dto.burialDate > today)
      throw new BadRequestException('Ngày an táng không được sau ngày hiện tại');
    if (dto.dateOfBirth && dto.dateOfDeath && dto.dateOfDeath < dto.dateOfBirth)
      throw new BadRequestException('Ngày mất không được trước ngày sinh');
    if (dto.dateOfDeath && dto.burialDate && dto.burialDate < dto.dateOfDeath)
      throw new BadRequestException('Ngày chôn cất không được trước ngày mất');
    if (dto.dateOfBirth && dto.burialDate && dto.burialDate < dto.dateOfBirth)
      throw new BadRequestException('Ngày an táng không được trước ngày sinh');
    if ((dto.anniversaryMonth == null) !== (dto.anniversaryDay == null))
      throw new BadRequestException('Ngày giỗ không hợp lệ');
  }
  private audit(
    client: PoolClient,
    userId: number,
    action: string,
    id: number,
    before: unknown,
    after: unknown,
  ) {
    return client.query(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value) VALUES($1,$2,'deceased_profile',$3,$4::jsonb,$5::jsonb)`,
      [userId, action, id, JSON.stringify(before), JSON.stringify(after)],
    );
  }
}
