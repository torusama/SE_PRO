import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface RequestInfo {
  ip?: string;
  userAgent?: string;
}

const REGISTRATION_OTP_TTL_MINUTES = 10;
const REGISTRATION_TOKEN_TTL_MINUTES = 15;
const REGISTRATION_OTP_COOLDOWN_SECONDS = 60;
const REGISTRATION_OTP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sessionsService: SessionsService,
    private readonly emailService: EmailService,
  ) {}

  async sendRegistrationOtp(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    const existing = await this.database.queryOne(
      'SELECT user_id FROM users WHERE LOWER(email) = $1',
      [email],
    );
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const current = await this.database.queryOne<{
      otp_last_sent_at: Date;
    }>(
      `SELECT otp_last_sent_at
       FROM registration_email_verifications
       WHERE email = $1`,
      [email],
    );
    if (current?.otp_last_sent_at) {
      const elapsedSeconds =
        (Date.now() - new Date(current.otp_last_sent_at).getTime()) / 1000;
      if (elapsedSeconds < REGISTRATION_OTP_COOLDOWN_SECONDS) {
        const wait = Math.ceil(
          REGISTRATION_OTP_COOLDOWN_SECONDS - elapsedSeconds,
        );
        throw new BadRequestException(
          `Vui lòng chờ ${wait} giây trước khi gửi lại mã OTP.`,
        );
      }
    }

    const otpCode = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);
    await this.database.query(
      `INSERT INTO registration_email_verifications
         (email, otp_hash, otp_expires_at, otp_attempts, otp_last_sent_at,
          verified_at, registration_token_hash,
          registration_token_expires_at, updated_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW(),
               NULL, NULL, NULL, NOW())
       ON CONFLICT (email) DO UPDATE
       SET otp_hash = EXCLUDED.otp_hash,
           otp_expires_at = EXCLUDED.otp_expires_at,
           otp_attempts = 0,
           otp_last_sent_at = NOW(),
           verified_at = NULL,
           registration_token_hash = NULL,
           registration_token_expires_at = NULL,
           updated_at = NOW()`,
      [email, otpHash],
    );

    try {
      await this.emailService.sendOtpEmail(email, otpCode, 'đăng ký tài khoản');
    } catch (error) {
      await this.database.query(
        `DELETE FROM registration_email_verifications
         WHERE email = $1 AND otp_hash = $2`,
        [email, otpHash],
      );
      throw error;
    }
    return { sent: true, expiresInMinutes: REGISTRATION_OTP_TTL_MINUTES };
  }

  async verifyRegistrationOtp(rawEmail: string, otpCode: string) {
    const email = this.normalizeEmail(rawEmail);
    const row = await this.database.queryOne<{
      otp_hash: string;
      otp_expires_at: Date;
      otp_attempts: number;
    }>(
      `SELECT otp_hash, otp_expires_at, otp_attempts
       FROM registration_email_verifications
       WHERE email = $1`,
      [email],
    );
    if (!row) {
      throw new BadRequestException(
        'Chưa có mã OTP cho email này. Vui lòng gửi mã trước.',
      );
    }
    if (new Date(row.otp_expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Mã OTP đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (row.otp_attempts >= REGISTRATION_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi mã mới.',
      );
    }

    const valid = await bcrypt.compare(otpCode, row.otp_hash);
    if (!valid) {
      await this.database.query(
        `UPDATE registration_email_verifications
         SET otp_attempts = otp_attempts + 1, updated_at = NOW()
         WHERE email = $1`,
        [email],
      );
      throw new UnauthorizedException('Mã OTP không đúng.');
    }

    const registrationToken = randomBytes(32).toString('hex');
    await this.database.query(
      `UPDATE registration_email_verifications
       SET verified_at = NOW(),
           registration_token_hash = $2,
           registration_token_expires_at = NOW() + INTERVAL '15 minutes',
           updated_at = NOW()
       WHERE email = $1`,
      [email, this.hashRegistrationToken(registrationToken)],
    );
    return {
      verified: true,
      registrationToken,
      expiresInMinutes: REGISTRATION_TOKEN_TTL_MINUTES,
    };
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.database.queryOne(
      'SELECT user_id FROM users WHERE LOWER(email) = $1',
      [email],
    );
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.database.transaction(async (client) => {
        const result = await client.query<{
          registration_token_hash: string | null;
          registration_token_expires_at: Date | null;
          verified_at: Date | null;
        }>(
          `SELECT registration_token_hash, registration_token_expires_at,
                  verified_at
           FROM registration_email_verifications
           WHERE email = $1
           FOR UPDATE`,
          [email],
        );
        const verification = result.rows[0];
        const suppliedTokenHash = this.hashRegistrationToken(
          dto.registrationToken,
        );
        if (
          !verification?.verified_at ||
          !verification.registration_token_hash ||
          verification.registration_token_hash !== suppliedTokenHash
        ) {
          throw new UnauthorizedException(
            'Email chưa được xác thực hoặc phiên đăng ký không hợp lệ.',
          );
        }
        if (
          !verification.registration_token_expires_at ||
          new Date(verification.registration_token_expires_at).getTime() <=
            Date.now()
        ) {
          throw new UnauthorizedException(
            'Phiên đăng ký đã hết hạn. Vui lòng xác thực email lại.',
          );
        }

        await client.query(
          `INSERT INTO users
             (email, password_hash, role, full_name, phone_number,
              email_verified_at)
           VALUES ($1, $2, 'Customer', $3, $4, NOW())`,
          [email, passwordHash, dto.fullName.trim(), dto.phone?.trim() || null],
        );
        await client.query(
          'DELETE FROM registration_email_verifications WHERE email = $1',
          [email],
        );
        return { created: true, email };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, requestInfo: RequestInfo = {}) {
    const user = await this.database.queryOne(
      `SELECT user_id, email, password_hash, role, full_name, phone_number,
              address, date_of_birth, gender,
              emergency_contact_name, emergency_contact_phone,
              email_verified_at, emergency_contact_email_verified_at, is_active
       FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [this.normalizeEmail(dto.email)],
    );
    if (!user) {
      throw new UnauthorizedException(
        'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại thông tin đăng nhập.',
      );
    }
    if (!user.is_active) {
      throw new UnauthorizedException(
        'Tài khoản này đã bị khoá. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
      );
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException(
        'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại thông tin đăng nhập.',
      );
    }

    await this.database.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [user.user_id],
    );
    return this.withToken(user, requestInfo);
  }

  async forgotPassword(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.database.queryOne<{
      user_id: number;
      is_active: boolean;
    }>(
      `SELECT user_id, is_active FROM users
       WHERE LOWER(email) = $1 AND is_deleted = FALSE`,
      [email],
    );

    // Không tiết lộ việc email có tồn tại hay không (chống dò email) — luôn
    // trả về cùng một kết quả cho người gọi, chỉ thực sự gửi mail khi user
    // tồn tại và đang hoạt động.
    if (user && user.is_active) {
      const current = await this.database.queryOne<{ created_at: Date }>(
        `SELECT created_at FROM password_reset_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.user_id],
      );
      if (current?.created_at) {
        const elapsedSeconds =
          (Date.now() - new Date(current.created_at).getTime()) / 1000;
        if (elapsedSeconds < PASSWORD_RESET_COOLDOWN_SECONDS) {
          const wait = Math.ceil(
            PASSWORD_RESET_COOLDOWN_SECONDS - elapsedSeconds,
          );
          throw new BadRequestException(
            `Vui lòng chờ ${wait} giây trước khi yêu cầu gửi lại liên kết.`,
          );
        }
      }

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashRegistrationToken(rawToken);
      await this.database.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [user.user_id, tokenHash],
      );

      const frontendUrl =
        this.config.get<string>('frontendUrl') ?? 'http://localhost:5173';
      const resetLink = `${frontendUrl.replace(/\/$/, '')}/dat-lai-mat-khau?token=${rawToken}`;

      await this.emailService.sendPasswordResetEmail(email, resetLink);
    }

    return {
      sent: true,
      message:
        'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.',
    };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.hashRegistrationToken(rawToken);
    const row = await this.database.queryOne<{
      token_id: number;
      user_id: number;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT token_id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );

    if (!row) {
      throw new BadRequestException(
        'Liên kết đặt lại mật khẩu không hợp lệ.',
      );
    }
    if (row.used_at) {
      throw new BadRequestException(
        'Liên kết này đã được sử dụng. Vui lòng yêu cầu liên kết mới.',
      );
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException(
        'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu liên kết mới.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.database.transaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [passwordHash, row.user_id],
      );
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_id = $1',
        [row.token_id],
      );
      // Vô hiệu hoá mọi token đặt lại mật khẩu khác đang chờ của user này.
      await client.query(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [row.user_id],
      );
    });

    // Đăng xuất khỏi mọi phiên hiện tại để đảm bảo an toàn sau khi đổi mật khẩu.
    await this.sessionsService.revokeOtherSessions(row.user_id, null);

    return { reset: true };
  }

  async me(userId: number) {
    return this.database.queryOne(
      `SELECT user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
              phone_number AS phone, is_active AS "isActive", created_at AS "createdAt"
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [userId],
    );
  }

  async logout(jti: string | undefined) {
    if (jti) await this.sessionsService.revokeByJti(jti);
    return { loggedOut: true };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashRegistrationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async withToken(user: any, requestInfo: RequestInfo) {
    const jti = randomUUID();
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: String(user.role).toLowerCase(),
      jti,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (this.config.get<string>('jwtExpiresIn') ?? '1d') as any,
    });
    await this.sessionsService.createSession(user.user_id, jti, requestInfo);

    const isProfileComplete = Boolean(
      user.full_name &&
      user.phone_number &&
      user.address &&
      user.date_of_birth &&
      user.gender &&
      user.emergency_contact_name &&
      user.emergency_contact_phone,
    );
    return {
      accessToken,
      user: {
        id: user.user_id,
        email: user.email,
        role: String(user.role).toLowerCase(),
        fullName: user.full_name,
        phone: user.phone_number,
        isActive: user.is_active,
        isProfileComplete,
      },
    };
  }
}
