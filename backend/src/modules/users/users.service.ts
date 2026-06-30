import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

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
    const user = await this.database.queryOne(
      `SELECT user_id AS id, email, LOWER(role) AS role, full_name AS "fullName",
              phone_number AS phone, address, id_card_number AS "idCardNumber",
              date_of_birth AS "dateOfBirth", gender, avatar_url AS "avatarUrl",
              is_active AS "isActive", created_at AS "createdAt"
       FROM users
       WHERE user_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
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
}
