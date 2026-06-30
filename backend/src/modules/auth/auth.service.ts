import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.database.queryOne(
      'SELECT user_id FROM users WHERE email = $1 AND is_deleted = FALSE',
      [dto.email.toLowerCase()],
    );
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.database.queryOne(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, 'Customer', $3, $4)
       RETURNING user_id, email, role, full_name, phone_number, is_active, created_at`,
      [dto.email.toLowerCase(), passwordHash, dto.fullName, dto.phone ?? null],
    );

    return this.withToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.database.queryOne(
      `SELECT user_id, email, password_hash, role, full_name, phone_number, is_active
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

    return this.withToken(user);
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

  private withToken(user: any) {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: String(user.role).toLowerCase(),
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (this.config.get<string>('jwtExpiresIn') ?? '1d') as any,
    });

    return {
      accessToken,
      user: {
        id: user.user_id,
        email: user.email,
        role: String(user.role).toLowerCase(),
        fullName: user.full_name,
        phone: user.phone_number,
        isActive: user.is_active,
      },
    };
  }
}
