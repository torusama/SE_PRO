import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret') ?? 'change_this_secret',
    });
  }

  async validate(payload: { sub: number; email: string; role: string }) {
    const user = await this.database.queryOne(
      `SELECT user_id, email, role, full_name, phone_number, is_active
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [payload.sub],
    );
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User is not active');
    }

    return {
      id: user.user_id,
      email: user.email,
      role: String(user.role).toLowerCase(),
      fullName: user.full_name,
      phone: user.phone_number,
    };
  }
}
