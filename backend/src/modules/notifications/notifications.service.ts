import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  AdminNotificationQueryDto,
  BroadcastNotificationDto,
} from './dto/admin-notification.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit?: AdminAuditService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

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
    if (!row) throw new NotFoundException('Không tìm thấy thông báo này.');
    return row;
  }

  async markUnread(userId: number, id: number) {
    const row = await this.database.queryOne(
      `UPDATE notifications SET is_read = FALSE, read_at = NULL
       WHERE notification_id = $1 AND user_id = $2
       RETURNING notification_id AS id, is_read AS "isRead"`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy thông báo này.');
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

  async deleteAll(userId: number) {
    const result = await this.database.query(
      'DELETE FROM notifications WHERE user_id = $1 RETURNING notification_id',
      [userId],
    );
    return { deleted: result.length };
  }

  async createInApp(
    userId: number,
    type: string,
    title: string,
    message: string,
    relatedEntityType?: string,
    relatedEntityId?: number,
  ) {
    const notification = await this.database.queryOne(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING notification_id AS id, type, title, message`,
      [
        userId,
        type,
        title,
        message,
        relatedEntityType ?? null,
        relatedEntityId ?? null,
      ],
    );
    this.realtime?.publishToUser(userId, ['notifications']);
    return notification;
  }

  async createInAppWithClient(
    client: PoolClient,
    userId: number,
    type: string,
    title: string,
    message: string,
    relatedEntityType?: string,
    relatedEntityId?: number,
  ) {
    const result = await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING notification_id AS id, type, title, message`,
      [
        userId,
        type,
        title,
        message,
        relatedEntityType ?? null,
        relatedEntityId ?? null,
      ],
    );
    return result.rows[0];
  }

  async adminList(query: AdminNotificationQueryDto) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(n.title ILIKE ${p} OR n.message ILIKE ${p} OR u.full_name ILIKE ${p})`,
      );
    }
    if (query.isRead !== undefined)
      conditions.push(`n.is_read=${add(query.isRead)}`);
    if (query.broadcast !== undefined) {
      conditions.push(
        query.broadcast
          ? `n.related_entity_type='admin_broadcast'`
          : `(n.related_entity_type IS DISTINCT FROM 'admin_broadcast')`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM notifications n
       JOIN users u ON u.user_id=n.user_id ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.database.query(
      `SELECT n.notification_id AS id, n.type, n.title, n.message,
              n.is_read AS "isRead", n.created_at AS "createdAt",
              n.related_entity_type='admin_broadcast' AS broadcast,
              u.user_id AS "recipientId", u.full_name AS "recipientName"
       FROM notifications n JOIN users u ON u.user_id=n.user_id ${where}
       ORDER BY n.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
  }

  async broadcast(dto: BroadcastNotificationDto, context: AdminRequestContext) {
    if (dto.channel !== 'in_app') {
      throw new BadRequestException('Only in-app broadcast is supported');
    }
    return this.database.transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO notifications
           (user_id,type,title,message,related_entity_type)
         SELECT user_id,$1,$2,$3,'admin_broadcast'
         FROM users
         WHERE LOWER(role)='customer' AND is_active=TRUE AND is_deleted=FALSE
         RETURNING notification_id`,
        [dto.type, dto.title, dto.content],
      );
      await this.audit?.record(client, {
        action: 'notification.broadcast',
        entityType: 'admin_broadcast',
        entityKey: `broadcast-${Date.now()}`,
        after: {
          audience: dto.audience,
          channel: dto.channel,
          recipientCount: inserted.rowCount,
          title: dto.title,
        },
        context,
      });
      return { recipientCount: inserted.rowCount, channel: dto.channel };
    });
  }
}
