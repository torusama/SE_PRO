import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Các trường bắt buộc để coi hồ sơ là "đã hoàn thiện". Dùng để chặn
// người dùng mới đăng ký cho đến khi họ tự cập nhật hồ sơ.
const REQUIRED_PROFILE_FIELDS = [
  'fullName',
  'phone',
  'dateOfBirth',
  'gender',
  'address',
] as const;

function computeIsProfileComplete(row: Record<string, unknown>): boolean {
  return REQUIRED_PROFILE_FIELDS.every((field) => {
    const value = row[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

const USER_SELECT_COLUMNS = `
  user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
  phone_number AS phone, address, id_card_number AS "idCardNumber",
  date_of_birth AS "dateOfBirth", gender, avatar_url AS "avatarUrl",
  nationality, city, postal_code AS "postalCode",
  emergency_contact_name AS "emergencyContactName",
  emergency_contact_relation AS "emergencyContactRelation",
  emergency_contact_phone AS "emergencyContactPhone",
  emergency_contact_email AS "emergencyContactEmail",
  notes,
  notify_payment AS "notifyPayment", notify_service AS "notifyService",
  notify_anniversary AS "notifyAnniversary", notify_announcement AS "notifyAnnouncement",
  is_active AS "isActive", created_at AS "createdAt"
`;

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async me(userId: number) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll() {
    return this.database.query(
      `SELECT user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
              phone_number AS phone, is_active AS "isActive", created_at AS "createdAt"
       FROM users
       WHERE is_deleted = FALSE
       ORDER BY created_at DESC`,
    );
  }

  async findById(id: number) {
    const user = await this.database.queryOne<Record<string, unknown>>(
      `SELECT ${USER_SELECT_COLUMNS}
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!user) throw new NotFoundException('User not found');
    return { ...user, isProfileComplete: computeIsProfileComplete(user) };
  }

  async updateStatus(id: number, isActive: boolean) {
    const user = await this.database.queryOne(
      `UPDATE users SET is_active = $2, updated_at = NOW()
       WHERE user_id = $1 AND is_deleted = FALSE
       RETURNING user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
                 is_active AS "isActive"`,
      [id, isActive],
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.database.queryOne<Record<string, unknown>>(
      `UPDATE users
       SET full_name                   = COALESCE($2, full_name),
           date_of_birth               = COALESCE($3, date_of_birth),
           gender                      = COALESCE($4, gender),
           address                     = COALESCE($5, address),
           phone_number                = COALESCE($6, phone_number),
           nationality                 = COALESCE($7, nationality),
           city                        = COALESCE($8, city),
           postal_code                 = COALESCE($9, postal_code),
           emergency_contact_name      = COALESCE($10, emergency_contact_name),
           emergency_contact_relation  = COALESCE($11, emergency_contact_relation),
           emergency_contact_phone     = COALESCE($12, emergency_contact_phone),
           emergency_contact_email     = COALESCE($13, emergency_contact_email),
           notes                       = COALESCE($14, notes),
           notify_payment              = COALESCE($15, notify_payment),
           notify_service              = COALESCE($16, notify_service),
           notify_anniversary          = COALESCE($17, notify_anniversary),
           notify_announcement         = COALESCE($18, notify_announcement),
           updated_at                  = NOW()
       WHERE user_id = $1 AND is_deleted = FALSE
       RETURNING ${USER_SELECT_COLUMNS}`,
      [
        userId,
        dto.fullName ?? null,
        dto.dateOfBirth ?? null,
        dto.gender ?? null,
        dto.address ?? null,
        dto.phone ?? null,
        dto.nationality ?? null,
        dto.city ?? null,
        dto.postalCode ?? null,
        dto.emergencyContactName ?? null,
        dto.emergencyContactRelation ?? null,
        dto.emergencyContactPhone ?? null,
        dto.emergencyContactEmail ?? null,
        dto.notes ?? null,
        dto.notifyPayment ?? null,
        dto.notifyService ?? null,
        dto.notifyAnniversary ?? null,
        dto.notifyAnnouncement ?? null,
      ],
    );
    if (!user) throw new NotFoundException('User not found');
    return { ...user, isProfileComplete: computeIsProfileComplete(user) };
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    const user = await this.database.queryOne(
      `UPDATE users SET avatar_url = $2, updated_at = NOW()
       WHERE user_id = $1 AND is_deleted = FALSE
       RETURNING user_id AS id, avatar_url AS "avatarUrl"`,
      [userId, avatarUrl],
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.database.queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches)
      throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.database.query(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, newHash],
    );
    return { changed: true };
  }

  async stats(userId: number) {
    const row = await this.database.queryOne<{
      lots: string;
      services: string;
      memberSince: Date;
    }>(
      `SELECT
         (SELECT COUNT(DISTINCT plot_id) FROM contracts
           WHERE user_id = $1 AND is_deleted = FALSE AND status IN ('active', 'expired')) AS lots,
         (SELECT COUNT(*) FROM service_orders
           WHERE user_id = $1 AND is_deleted = FALSE) AS services,
         (SELECT created_at FROM users WHERE user_id = $1) AS "memberSince"`,
      [userId],
    );
    const memberSince = row?.memberSince ? new Date(row.memberSince) : null;
    const years = memberSince
      ? Math.max(0, new Date().getFullYear() - memberSince.getFullYear())
      : 0;
    return {
      lots: Number(row?.lots ?? 0),
      services: Number(row?.services ?? 0),
      years,
      memberSince,
    };
  }
}
