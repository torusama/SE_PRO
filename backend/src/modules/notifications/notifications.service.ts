import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: number) {
    return this.database.query(
      `SELECT notification_id AS id, type, title, message, is_read AS "isRead",
              related_entity_type AS "relatedEntityType", related_entity_id AS "relatedEntityId",
              created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
  }

  async unreadCount(userId: number) {
    const row = await this.database.queryOne(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId],
    );
    return row;
  }

  async markRead(userId: number, id: number) {
    const row = await this.database.queryOne(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE notification_id = $1 AND user_id = $2
       RETURNING notification_id AS id, is_read AS "isRead"`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Notification not found');
    return row;
  }

  async readAll(userId: number) {
    await this.database.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return { updated: true };
  }
}
