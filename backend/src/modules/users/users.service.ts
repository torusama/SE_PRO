import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Các trường bắt buộc để coi hồ sơ là "đã hoàn thiện". Dùng để chặn
// người dùng mới đăng ký cho đến khi họ tự cập nhật hồ sơ.
const REQUIRED_PROFILE_FIELDS = [
  'fullName',
  'phone',
  'dateOfBirth',
  'gender',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
] as const;

function computeIsProfileComplete(row: Record<string, unknown>): boolean {
  return REQUIRED_PROFILE_FIELDS.every((field) => {
    const value = row[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
}

// CCCD/CMND là dữ liệu nhạy cảm: mặc định chỉ trả về dạng che (4 số cuối).
// Số đầy đủ chỉ lộ ra qua endpoint riêng, sau khi xác thực lại mật khẩu
// đăng nhập (xem revealIdCard/updateIdCard bên dưới) — kể cả khi JWT còn hiệu lực.
function maskIdCard(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.length <= 4) return '•'.repeat(value.length);
  return `•••• •••• ${value.slice(-4)}`;
}

const USER_SELECT_COLUMNS = `
  user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
  phone_number AS phone, address, id_card_number AS "idCardNumber",
  date_of_birth AS "dateOfBirth", gender, avatar_url AS "avatarUrl",
  nationality, city, ward, postal_code AS "postalCode",
  emergency_contact_name AS "emergencyContactName",
  emergency_contact_relation AS "emergencyContactRelation",
  emergency_contact_phone AS "emergencyContactPhone",
  emergency_contact_email AS "emergencyContactEmail",
  notes,
  notify_payment AS "notifyPayment", notify_service AS "notifyService",
  notify_anniversary AS "notifyAnniversary", notify_announcement AS "notifyAnnouncement",
  (email_verified_at IS NOT NULL) AS "isEmailVerified",
  (emergency_contact_email_verified_at IS NOT NULL) AS "isEmergencyEmailVerified",
  password_changed_at AS "passwordChangedAt",
  is_active AS "isActive", created_at AS "createdAt"
`;

const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

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
    return {
      ...user,
      idCardNumber: maskIdCard(user.idCardNumber),
      isProfileComplete: computeIsProfileComplete(user),
    };
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
           ward                        = COALESCE($19, ward),
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
        dto.ward ?? null,
      ],
    );
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      idCardNumber: maskIdCard(user.idCardNumber),
      isProfileComplete: computeIsProfileComplete(user),
    };
  }

  async revealIdCard(userId: number, password: string) {
    const row = await this.database.queryOne<{
      password_hash: string;
      id_card_number: string | null;
    }>(
      `SELECT password_hash, id_card_number FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');
    const matches = await bcrypt.compare(password, row.password_hash);
    if (!matches) throw new UnauthorizedException('Mật khẩu không đúng');
    return { idCardNumber: row.id_card_number };
  }

  async updateIdCard(userId: number, password: string, idCardNumber: string) {
    const row = await this.database.queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');
    const matches = await bcrypt.compare(password, row.password_hash);
    if (!matches) throw new UnauthorizedException('Mật khẩu không đúng');
    const updated = await this.database.queryOne<{
      id_card_number: string | null;
    }>(
      `UPDATE users SET id_card_number = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id_card_number`,
      [userId, idCardNumber],
    );
    return { idCardNumber: updated?.id_card_number ?? null };
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

  async sendPasswordChangeOtp(userId: number) {
    const row = await this.database.queryOne<{
      email: string;
      password_otp_last_sent_at: Date | null;
    }>(
      `SELECT email, password_otp_last_sent_at FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');
    this.assertCooldownElapsed(row.password_otp_last_sent_at);

    const code = generateOtpCode();
    const hash = await bcrypt.hash(code, 10);
    await this.database.query(
      `UPDATE users
       SET password_otp_hash = $2, password_otp_expires_at = NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes',
           password_otp_attempts = 0, password_otp_last_sent_at = NOW()
       WHERE user_id = $1`,
      [userId, hash],
    );
    await this.emailService.sendOtpEmail(row.email, code, 'đổi mật khẩu');
    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    otpCode: string,
  ) {
    const user = await this.database.queryOne<{
      password_hash: string;
      password_otp_hash: string | null;
      password_otp_expires_at: Date | null;
      password_otp_attempts: number;
    }>(
      `SELECT password_hash, password_otp_hash, password_otp_expires_at, password_otp_attempts
       FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches)
      throw new BadRequestException('Current password is incorrect');

    await this.assertOtpMatches(
      user.password_otp_hash,
      user.password_otp_expires_at,
      user.password_otp_attempts,
      otpCode,
      async () => {
        await this.database.query(
          `UPDATE users SET password_otp_attempts = password_otp_attempts + 1 WHERE user_id = $1`,
          [userId],
        );
      },
    );

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.database.query(
      `UPDATE users
       SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW(),
           password_otp_hash = NULL, password_otp_expires_at = NULL, password_otp_attempts = 0
       WHERE user_id = $1`,
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

  // ---------------------------------------------------------------------
  // Xác thực email bằng OTP — dùng chung logic cho cả 2 trường hợp:
  //  - email đăng nhập của chính chủ tài khoản (cột email_*)
  //  - email người liên hệ khẩn cấp (cột emergency_contact_*)
  // ---------------------------------------------------------------------

  async sendOwnEmailOtp(userId: number) {
    const row = await this.database.queryOne<{
      email: string;
      email_otp_last_sent_at: Date | null;
    }>(
      `SELECT email, email_otp_last_sent_at FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');
    this.assertCooldownElapsed(row.email_otp_last_sent_at);

    const code = generateOtpCode();
    const hash = await bcrypt.hash(code, 10);
    await this.database.query(
      `UPDATE users
       SET email_otp_hash = $2, email_otp_expires_at = NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes',
           email_otp_attempts = 0, email_otp_last_sent_at = NOW()
       WHERE user_id = $1`,
      [userId, hash],
    );
    await this.emailService.sendOtpEmail(row.email, code, 'tài khoản của bạn');
    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  async verifyOwnEmailOtp(userId: number, code: string) {
    const row = await this.database.queryOne<{
      email_otp_hash: string | null;
      email_otp_expires_at: Date | null;
      email_otp_attempts: number;
    }>(
      `SELECT email_otp_hash, email_otp_expires_at, email_otp_attempts
       FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');

    await this.assertOtpMatches(
      row.email_otp_hash,
      row.email_otp_expires_at,
      row.email_otp_attempts,
      code,
      async () => {
        await this.database.query(
          `UPDATE users SET email_otp_attempts = email_otp_attempts + 1 WHERE user_id = $1`,
          [userId],
        );
      },
    );

    await this.database.query(
      `UPDATE users
       SET email_verified_at = NOW(), email_otp_hash = NULL,
           email_otp_expires_at = NULL, email_otp_attempts = 0
       WHERE user_id = $1`,
      [userId],
    );
    return { verified: true };
  }

  async sendEmergencyEmailOtp(userId: number) {
    const row = await this.database.queryOne<{
      emergency_contact_email: string | null;
      emergency_contact_otp_last_sent_at: Date | null;
    }>(
      `SELECT emergency_contact_email, emergency_contact_otp_last_sent_at
       FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');
    if (!row.emergency_contact_email) {
      throw new BadRequestException(
        'Chưa có email người liên hệ khẩn cấp — vui lòng nhập ở tab "Thông tin cá nhân" trước.',
      );
    }
    this.assertCooldownElapsed(row.emergency_contact_otp_last_sent_at);

    const code = generateOtpCode();
    const hash = await bcrypt.hash(code, 10);
    await this.database.query(
      `UPDATE users
       SET emergency_contact_otp_hash = $2,
           emergency_contact_otp_expires_at = NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes',
           emergency_contact_otp_attempts = 0, emergency_contact_otp_last_sent_at = NOW()
       WHERE user_id = $1`,
      [userId, hash],
    );
    await this.emailService.sendOtpEmail(
      row.emergency_contact_email,
      code,
      'người liên hệ khẩn cấp',
    );
    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  async verifyEmergencyEmailOtp(userId: number, code: string) {
    const row = await this.database.queryOne<{
      emergency_contact_otp_hash: string | null;
      emergency_contact_otp_expires_at: Date | null;
      emergency_contact_otp_attempts: number;
    }>(
      `SELECT emergency_contact_otp_hash, emergency_contact_otp_expires_at,
              emergency_contact_otp_attempts
       FROM users WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
    if (!row) throw new NotFoundException('User not found');

    await this.assertOtpMatches(
      row.emergency_contact_otp_hash,
      row.emergency_contact_otp_expires_at,
      row.emergency_contact_otp_attempts,
      code,
      async () => {
        await this.database.query(
          `UPDATE users SET emergency_contact_otp_attempts = emergency_contact_otp_attempts + 1 WHERE user_id = $1`,
          [userId],
        );
      },
    );

    await this.database.query(
      `UPDATE users
       SET emergency_contact_email_verified_at = NOW(), emergency_contact_otp_hash = NULL,
           emergency_contact_otp_expires_at = NULL, emergency_contact_otp_attempts = 0
       WHERE user_id = $1`,
      [userId],
    );
    return { verified: true };
  }

  private assertCooldownElapsed(lastSentAt: Date | null) {
    if (!lastSentAt) return;
    const elapsedSeconds = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new BadRequestException(
        `Vui lòng đợi ${wait} giây trước khi gửi lại mã.`,
      );
    }
  }

  private async assertOtpMatches(
    hash: string | null,
    expiresAt: Date | null,
    attempts: number,
    code: string,
    onMismatch: () => Promise<void>,
  ) {
    if (!hash || !expiresAt) {
      throw new BadRequestException(
        'Chưa có mã OTP nào được gửi, hoặc mã đã được sử dụng. Vui lòng bấm gửi lại mã.',
      );
    }
    if (new Date(expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Mã OTP đã hết hạn, vui lòng gửi lại mã.');
    }
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Bạn đã nhập sai quá số lần cho phép. Vui lòng bấm gửi lại mã.',
      );
    }
    const matches = await bcrypt.compare(code, hash);
    if (!matches) {
      await onMismatch();
      throw new UnauthorizedException('Mã OTP không đúng.');
    }
  }
}
