import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { AuthUser } from './deceased.types';

@Injectable()
export class DeceasedMapService {
  constructor(private readonly database: DatabaseService) {}
  visible(user: AuthUser) {
    if (user.role.toLowerCase() === 'admin') return this.query('TRUE', []);
    return this.query(
      `EXISTS(SELECT 1 FROM ownership_records o WHERE o.plot_id=dp.plot_id AND o.user_id=$1 AND o.is_current=TRUE) OR EXISTS(SELECT 1 FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id AND fm.is_active=TRUE JOIN family_groups fg ON fg.family_id=fm.family_id AND fg.status='active' AND fg.is_deleted=FALSE WHERE fm.user_id=$1 AND rp.resource_type='deceased_profile' AND rp.resource_id=dp.deceased_profile_id AND rp.action='view_profile' AND rp.revoked_at IS NULL)`,
      [user.id],
    );
  }
  private query(access: string, params: unknown[]) {
    return this.database.query(
      `SELECT dp.deceased_profile_id AS "deceasedProfileId",dp.full_name AS "fullName",p.plot_id AS "plotId",p.plot_code AS "plotCode",p.status,p.map_x AS "mapX",p.map_y AS "mapY",p.map_width AS "mapWidth",p.map_height AS "mapHeight",z.zone_id AS "zoneId",z.zone_name AS "zoneName" FROM deceased_profiles dp JOIN plots p ON p.plot_id=dp.plot_id JOIN cemetery_zones z ON z.zone_id=p.zone_id WHERE dp.is_deleted=FALSE AND p.is_deleted=FALSE AND (${access})`,
      params,
    );
  }
}
