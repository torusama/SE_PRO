import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FamilyInvitationService {
  constructor(private readonly database: DatabaseService) {}
  accept(id: number, userId: number) {
    return this.process(id, userId, 'accepted');
  }
  reject(id: number, userId: number) {
    return this.process(id, userId, 'rejected');
  }
  private async process(
    id: number,
    userId: number,
    next: 'accepted' | 'rejected',
  ) {
    return this.database.transaction(async (client) => {
      const invite = (
        await client.query(
          `SELECT fi.*,fg.status AS family_status,fg.is_deleted AS family_deleted FROM family_invitations fi JOIN family_groups fg ON fg.family_id=fi.family_id WHERE fi.invitation_id=$1 FOR UPDATE OF fi`,
          [id],
        )
      ).rows[0];
      if (!invite || invite.invitee_user_id !== userId)
        throw new NotFoundException('Không tìm thấy lời mời');
      if (invite.status !== 'pending')
        throw new ConflictException('Lời mời đã được xử lý');
      if (invite.family_status !== 'active' || invite.family_deleted)
        throw new BadRequestException('Gia đình không hoạt động');
      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        await client.query(
          `UPDATE family_invitations SET status='expired',processed_at=NOW() WHERE invitation_id=$1`,
          [id],
        );
        throw new BadRequestException('Lời mời đã hết hạn');
      }
      if (next === 'accepted')
        await client.query(
          `INSERT INTO family_memberships(family_id,user_id)VALUES($1,$2)`,
          [invite.family_id, userId],
        );
      await client.query(
        `UPDATE family_invitations SET status=$2,processed_at=NOW() WHERE invitation_id=$1`,
        [id, next],
      );
      await client.query(
        `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value)VALUES($1,$2,'family_invitation',$3,$4::jsonb)`,
        [
          userId,
          `family.invitation.${next}`,
          id,
          JSON.stringify({ familyId: invite.family_id }),
        ],
      );
      return { id, status: next };
    });
  }
}
