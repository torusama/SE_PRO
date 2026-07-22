import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateAuthorizedPersonDto,
  UpdateAuthorizedPersonDto,
} from './dto/authorized-person.dto';

const SELECT_COLUMNS = `
  id, full_name AS "fullName", relation, phone, email, permission,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

@Injectable()
export class AuthorizedPersonsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: number) {
    return this.database.query(
      `SELECT ${SELECT_COLUMNS} FROM user_authorized_persons
       WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
  }

  async create(userId: number, dto: CreateAuthorizedPersonDto) {
    return this.database.queryOne(
      `INSERT INTO user_authorized_persons
         (user_id, full_name, relation, phone, email, permission)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [
        userId,
        dto.fullName,
        dto.relation ?? null,
        dto.phone ?? null,
        dto.email ?? null,
        dto.permission ?? 'view',
      ],
    );
  }

  async update(userId: number, id: number, dto: UpdateAuthorizedPersonDto) {
    const row = await this.database.queryOne(
      `UPDATE user_authorized_persons
       SET full_name  = COALESCE($3, full_name),
           relation   = COALESCE($4, relation),
           phone      = COALESCE($5, phone),
           email      = COALESCE($6, email),
           permission = COALESCE($7, permission),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        userId,
        dto.fullName ?? null,
        dto.relation ?? null,
        dto.phone ?? null,
        dto.email ?? null,
        dto.permission ?? null,
      ],
    );
    if (!row) throw new NotFoundException('Authorized person not found');
    return row;
  }

  async remove(userId: number, id: number) {
    const row = await this.database.queryOne(
      `DELETE FROM user_authorized_persons WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Authorized person not found');
    return { deleted: true };
  }
}
