import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../../database/database.service';
import { SessionsService } from '../../sessions/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret') ?? 'change_this_secret',
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    role: string;
    jti?: string;
  }) {
    // Nếu JWT có gắn jti (mọi token phát hành từ nay), phiên phải còn tồn tại
    // và CHƯA bị thu hồi trong bảng user_sessions — cho phép "đăng xuất từ xa"
    // thực sự có tác dụng ngay cả khi chữ ký JWT vẫn còn hạn dùng.
    if (payload.jti) {
      const session = await this.sessionsService.touchSession(payload.jti);
      if (!session) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
      }
    }

    const user = await this.database.queryOne(
      `SELECT user_id, email, role, full_name, phone_number, is_active
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [payload.sub],
    );
    if (!user || !user.is_active) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
      );
    }

    return {
      id: user.user_id,
      email: user.email,
      role: String(user.role).toLowerCase(),
      fullName: user.full_name,
      phone: user.phone_number,
      jti: payload.jti,
    };
  }
}
