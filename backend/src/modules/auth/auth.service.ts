import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface RequestInfo {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sessionsService: SessionsService,
  ) {}

  async register(dto: RegisterDto, requestInfo: RequestInfo = {}) {
    const existing = await this.database.queryOne(
      'SELECT user_id FROM users WHERE email = $1 AND is_deleted = FALSE',
      [dto.email.toLowerCase()],
    );
    if (existing) throw new ConflictException('Email already exists');

    // Chỉ lưu những gì người dùng đã nhập khi đăng ký (fullName bắt buộc,
    // phone tuỳ chọn). Mọi trường hồ sơ khác (address, dateOfBirth, gender,
    // avatar, liên hệ khẩn cấp, ghi chú...) để trống/NULL theo mặc định của
    // bảng `users` — KHÔNG gán giá trị mẫu nào ở đây. Người dùng phải tự bổ
    // sung ở trang Hồ sơ trước khi dùng các chức năng chính (xem isProfileComplete).
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.database.queryOne(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, 'Customer', $3, $4)
       RETURNING user_id, email, role, full_name, phone_number, address,
                 date_of_birth, gender, emergency_contact_name,
                 emergency_contact_phone, email_verified_at,
                 emergency_contact_email_verified_at, is_active, created_at`,
      [dto.email.toLowerCase(), passwordHash, dto.fullName, dto.phone ?? null],
    );

    return this.withToken(user, requestInfo);
  }

  async login(dto: LoginDto, requestInfo: RequestInfo = {}) {
    const user = await this.database.queryOne(
      `SELECT user_id, email, password_hash, role, full_name, phone_number,
              address, date_of_birth, gender,
              emergency_contact_name, emergency_contact_phone,
              email_verified_at, emergency_contact_email_verified_at, is_active
       FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [dto.email.toLowerCase()],
    );
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.database.query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [user.user_id],
    );

    return this.withToken(user, requestInfo);
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
    // "profileComplete" trả về cho frontend là cổng truy cập TỔNG (dùng để
    // quyết định có chặn vào các chức năng chính hay không): phải vừa điền đủ
    // hồ sơ, vừa xác thực OTP cho cả email đăng nhập lẫn email người liên hệ
    // khẩn cấp. Trang Hồ sơ vẫn hiển thị riêng isProfileComplete/isEmailVerified/
    // isEmergencyEmailVerified (từ GET /users/me) để biết chính xác bước nào còn thiếu.
    const canAccessMainFeatures =
      isProfileComplete &&
      Boolean(user.email_verified_at) &&
      Boolean(user.emergency_contact_email_verified_at);

    return {
      accessToken,
      user: {
        id: user.user_id,
        email: user.email,
        role: String(user.role).toLowerCase(),
        fullName: user.full_name,
        phone: user.phone_number,
        isActive: user.is_active,
        isProfileComplete: canAccessMainFeatures,
      },
    };
  }
}
