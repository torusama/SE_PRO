import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DeceasedVerificationService {
  constructor(private readonly database: DatabaseService) {}
  verify(id: number, adminId: number) {
    return this.transition(id, adminId, 'verified', null);
  }
  reject(id: number, adminId: number, reason: string) {
    if (!reason.trim())
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    return this.transition(id, adminId, 'rejected', reason.trim());
  }
  private async transition(
    id: number,
    adminId: number,
    status: 'verified' | 'rejected',
    reason: string | null,
  ) {
    return this.database.transaction(async (client) => {
      const row = (
        await client.query(
          `SELECT * FROM deceased_profiles WHERE deceased_profile_id=$1 AND is_deleted=FALSE FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy hồ sơ');
      if (row.verification_status !== 'pending_verification')
        throw new BadRequestException(
          'Trạng thái hồ sơ không cho phép thao tác này',
        );
      await client.query(
        `UPDATE deceased_profiles SET verification_status=$2,rejection_reason=$3,reviewed_by=$4,reviewed_at=NOW() WHERE deceased_profile_id=$1`,
        [id, status, reason, adminId],
      );
      await client.query(
        `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,old_value,new_value) VALUES($1,$2,'deceased_profile',$3,$4::jsonb,$5::jsonb)`,
        [
          adminId,
          `deceased_profile.${status}`,
          id,
          JSON.stringify({ status: row.verification_status }),
          JSON.stringify({ status, reason }),
        ],
      );
      await client.query(
        `INSERT INTO notifications(user_id,type,title,message,related_entity_type,related_entity_id)
        SELECT o.user_id,$2,$3,$4,'deceased_profile',$1 FROM ownership_records o WHERE o.plot_id=$5 AND o.is_current=TRUE`,
        [
          id,
          `deceased_${status}`,
          status === 'verified' ? 'Hồ sơ đã được xác nhận' : 'Hồ sơ bị từ chối',
          reason ?? 'Hồ sơ người đã khuất đã được xác nhận',
          row.plot_id,
        ],
      );
      return { id, verificationStatus: status, rejectionReason: reason };
    });
  }
}
