import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { basename } from 'path';
import { DatabaseService } from '../../database/database.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import {
  CompleteServiceOrderDto,
  SERVICE_ORDER_STATUSES,
  ServiceOrderStatus,
  UpdateServiceOrderDto,
} from './dto/update-service-order.dto';

const SERVICE_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  submitted: 'đã được ghi nhận, đang chờ xác nhận',
  pending_confirm: 'đang chờ xác nhận',
  confirmed: 'đã được xác nhận',
  in_progress: 'đang được thực hiện',
  completed: 'đã hoàn thành',
  cancelled: 'đã bị huỷ',
};

const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  submitted: ['pending_confirm', 'confirmed', 'cancelled'],
  pending_confirm: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

interface ServiceOrderRow {
  order_id: number;
  user_id: number;
  status: ServiceOrderStatus;
  assigned_to: number | null;
  admin_note: string | null;
  scheduled_date: string | null;
  service_name: string;
}

@Injectable()
export class CemeteryServicesService {
  constructor(private readonly database: DatabaseService) {}

  serviceTypes() {
    return this.database.query(
      `SELECT service_type_id AS id, name, description,
              base_price::float AS "basePrice", unit, category
       FROM service_types
       WHERE is_active = TRUE AND is_deleted = FALSE
       ORDER BY sort_order, name`,
    );
  }

  async createOrder(userId: number, dto: CreateServiceOrderDto) {
    const type = await this.database.queryOne<{
      service_type_id: number;
      base_price: string;
      name: string;
    }>(
      `SELECT service_type_id, base_price, name
       FROM service_types
       WHERE service_type_id = $1 AND is_active = TRUE AND is_deleted = FALSE`,
      [dto.serviceTypeId],
    );
    if (!type) throw new NotFoundException('Không tìm thấy loại dịch vụ');

    return this.database.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO service_orders
           (user_id, plot_id, service_type_id, unit_price, amount, requested_date, note)
         VALUES ($1, $2, $3, $4, $4, $5, $6)
         RETURNING order_id AS id, status, amount::float`,
        [
          userId,
          dto.plotId ?? null,
          dto.serviceTypeId,
          type.base_price,
          dto.requestedDate ?? null,
          dto.note ?? null,
        ],
      );
      const order = result.rows[0];

      await client.query(
        `INSERT INTO service_order_history
           (order_id, changed_by, action, new_status, note)
         VALUES ($1, $2, 'submitted', 'submitted', $3)`,
        [order.id, userId, dto.note ?? null],
      );
      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_entity_type, related_entity_id)
         SELECT user_id, 'service_submitted', 'Đơn dịch vụ mới',
                CONCAT('Khách hàng vừa đặt dịch vụ "', $2::text,
                       '", đang chờ xác nhận.'),
                'service_order', $1
         FROM users
         WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
        [order.id, type.name],
      );
      return order;
    });
  }

  myOrders(userId: number) {
    return this.orders('WHERE so.user_id = $1 ORDER BY so.created_at DESC', [
      userId,
    ]);
  }

  adminOrders() {
    return this.orders('ORDER BY so.created_at DESC', [], true);
  }

  assignees() {
    return this.database.query(
      `SELECT user_id AS id, full_name AS name
       FROM users
       WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE
       ORDER BY full_name`,
    );
  }

  async one(id: number, userId?: number) {
    if (userId) {
      const order = await this.database.queryOne(
        this.ordersSql('WHERE so.order_id = $1 AND so.user_id = $2'),
        [id, userId],
      );
      if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ');
      return order;
    }

    const order = await this.database.queryOne(
      this.ordersSql('WHERE so.order_id = $1', true),
      [id],
    );
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ');

    const history = await this.database.query(
      `SELECT h.history_id AS id, h.action,
              h.previous_status AS "previousStatus",
              h.new_status AS "newStatus", h.note,
              h.created_at AS "createdAt",
              actor.full_name AS "changedByName",
              assignee.full_name AS "assignedToName"
       FROM service_order_history h
       LEFT JOIN users actor ON actor.user_id = h.changed_by
       LEFT JOIN users assignee ON assignee.user_id = h.assigned_to
       WHERE h.order_id = $1
       ORDER BY h.created_at DESC, h.history_id DESC`,
      [id],
    );
    return { ...order, history };
  }

  async updateStatus(id: number, status: string, adminId: number) {
    if (!SERVICE_ORDER_STATUSES.includes(status as ServiceOrderStatus)) {
      throw new BadRequestException('Trạng thái dịch vụ không hợp lệ');
    }
    return this.update(id, { status: status as ServiceOrderStatus }, adminId);
  }

  async update(id: number, dto: UpdateServiceOrderDto, adminId: number) {
    if (dto.status === 'completed') {
      throw new BadRequestException(
        'Hãy dùng chức năng xác nhận hoàn thành để lưu ghi chú và bằng chứng',
      );
    }
    if (
      dto.status === undefined &&
      dto.assignedTo === undefined &&
      dto.adminNote === undefined &&
      dto.scheduledDate === undefined
    ) {
      throw new BadRequestException('Không có thông tin cần cập nhật');
    }

    await this.database.transaction(async (client) => {
      const currentResult = await client.query<ServiceOrderRow>(
        `SELECT so.order_id, so.user_id, so.status, so.assigned_to,
                so.admin_note, so.scheduled_date, st.name AS service_name
         FROM service_orders so
         JOIN service_types st ON st.service_type_id = so.service_type_id
         WHERE so.order_id = $1 AND so.is_deleted = FALSE
         FOR UPDATE OF so`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ');

      const nextStatus = dto.status ?? current.status;
      this.assertTransition(current.status, nextStatus);

      if (dto.assignedTo !== undefined) {
        const assignee = await client.query(
          `SELECT user_id
           FROM users
           WHERE user_id = $1 AND LOWER(role) = 'admin'
             AND is_active = TRUE AND is_deleted = FALSE`,
          [dto.assignedTo],
        );
        if (!assignee.rows[0]) {
          throw new BadRequestException('Người xử lý không hợp lệ');
        }
      }

      const assignedTo = dto.assignedTo ?? current.assigned_to;
      const adminNote =
        dto.adminNote !== undefined
          ? dto.adminNote.trim() || null
          : current.admin_note;
      const scheduledDate = dto.scheduledDate ?? current.scheduled_date;

      await client.query(
        `UPDATE service_orders
         SET status = $2, assigned_to = $3, admin_note = $4,
             scheduled_date = $5, admin_id = $6, updated_at = NOW()
         WHERE order_id = $1`,
        [id, nextStatus, assignedTo, adminNote, scheduledDate, adminId],
      );

      const statusChanged = nextStatus !== current.status;
      const assignmentChanged = assignedTo !== current.assigned_to;
      const action = statusChanged
        ? `status_${nextStatus}`
        : assignmentChanged
          ? 'assigned'
          : 'updated';
      await this.recordHistoryAndAudit(client, {
        id,
        adminId,
        action,
        previousStatus: current.status,
        nextStatus,
        assignedTo,
        note: adminNote,
        oldValue: {
          status: current.status,
          assignedTo: current.assigned_to,
          adminNote: current.admin_note,
          scheduledDate: current.scheduled_date,
        },
        newValue: { status: nextStatus, assignedTo, adminNote, scheduledDate },
      });

      if (statusChanged) {
        await this.notifyStatusChange(
          client,
          current.user_id,
          id,
          current.service_name,
          nextStatus,
        );
      }
    });

    return this.one(id);
  }

  async complete(
    id: number,
    body: CompleteServiceOrderDto,
    adminId: number,
    files: Express.Multer.File[],
  ) {
    if (files.length === 0) {
      throw new BadRequestException(
        'Vui lòng tải lên ít nhất một ảnh bằng chứng hoàn thành',
      );
    }

    await this.database.transaction(async (client) => {
      const currentResult = await client.query<ServiceOrderRow>(
        `SELECT so.order_id, so.user_id, so.status, so.assigned_to,
                so.admin_note, so.scheduled_date, st.name AS service_name
         FROM service_orders so
         JOIN service_types st ON st.service_type_id = so.service_type_id
         WHERE so.order_id = $1 AND so.is_deleted = FALSE
         FOR UPDATE OF so`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ');
      this.assertTransition(current.status, 'completed');

      const filenames = files.map((file) => file.filename);
      const completionNote = body.completionNote?.trim() || null;
      await client.query(
        `UPDATE service_orders
         SET status = 'completed', completion_note = $2,
             completion_image_urls = $3, completed_at = NOW(),
             admin_id = $4, updated_at = NOW()
         WHERE order_id = $1`,
        [id, completionNote, filenames, adminId],
      );

      await this.recordHistoryAndAudit(client, {
        id,
        adminId,
        action: 'completed',
        previousStatus: current.status,
        nextStatus: 'completed',
        assignedTo: current.assigned_to,
        note: completionNote,
        oldValue: { status: current.status },
        newValue: {
          status: 'completed',
          completionNote,
          evidenceCount: filenames.length,
        },
      });
      await this.notifyStatusChange(
        client,
        current.user_id,
        id,
        current.service_name,
        'completed',
      );
    });

    return this.one(id);
  }

  async getEvidence(
    id: number,
    requestedFilename: string,
    user: { id: number; role: string },
  ) {
    const filename = basename(requestedFilename);
    if (filename !== requestedFilename) {
      throw new BadRequestException('Tên tệp không hợp lệ');
    }
    const order = await this.database.queryOne<{
      user_id: number;
      completion_image_urls: string[] | null;
    }>(
      `SELECT user_id, completion_image_urls
       FROM service_orders
       WHERE order_id = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ');
    if (user.role !== 'admin' && order.user_id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xem tệp này');
    }
    if (!order.completion_image_urls?.includes(filename)) {
      throw new NotFoundException('Không tìm thấy ảnh bằng chứng');
    }
    return { filename };
  }

  private assertTransition(
    current: ServiceOrderStatus,
    next: ServiceOrderStatus,
  ) {
    if (current === next) return;
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ "${current}" sang "${next}"`,
      );
    }
  }

  private async recordHistoryAndAudit(
    client: import('pg').PoolClient,
    data: {
      id: number;
      adminId: number;
      action: string;
      previousStatus: ServiceOrderStatus;
      nextStatus: ServiceOrderStatus;
      assignedTo: number | null;
      note: string | null;
      oldValue: Record<string, unknown>;
      newValue: Record<string, unknown>;
    },
  ) {
    await client.query(
      `INSERT INTO service_order_history
         (order_id, changed_by, action, previous_status, new_status,
          assigned_to, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.id,
        data.adminId,
        data.action,
        data.previousStatus,
        data.nextStatus,
        data.assignedTo,
        data.note,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, 'service_order', $3, $4::jsonb, $5::jsonb)`,
      [
        data.adminId,
        `service_order_${data.action}`,
        data.id,
        JSON.stringify(data.oldValue),
        JSON.stringify(data.newValue),
      ],
    );
  }

  private async notifyStatusChange(
    client: import('pg').PoolClient,
    userId: number,
    orderId: number,
    serviceName: string,
    status: ServiceOrderStatus,
  ) {
    await client.query(
      `INSERT INTO notifications
         (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, 'service_order', $5)`,
      [
        userId,
        `service_${status}`,
        status === 'completed'
          ? 'Dịch vụ đã hoàn thành'
          : 'Đơn dịch vụ đã cập nhật',
        `Dịch vụ "${serviceName}" của bạn hiện ${SERVICE_STATUS_LABEL[status]}.`,
        orderId,
      ],
    );
  }

  private orders(suffix: string, params: unknown[] = [], admin = false) {
    return this.database.query(this.ordersSql(suffix, admin), params);
  }

  private ordersSql(suffix: string, admin = false) {
    return `SELECT so.order_id AS id, so.status, so.amount::float,
                   so.requested_date AS "requestedDate",
                   so.scheduled_date AS "scheduledDate",
                   so.created_at AS "createdAt",
                   so.updated_at AS "updatedAt",
                   so.note, so.completion_note AS "completionNote",
                   so.completion_image_urls AS "completionImages",
                   so.completed_at AS "completedAt",
                   st.name AS "serviceName", st.category,
                   p.plot_code AS "plotCode",
                   u.full_name AS "customerName"
                   ${
                     admin
                       ? `,
                   u.email AS "customerEmail",
                   u.phone_number AS "customerPhone",
                   so.admin_note AS "adminNote",
                   so.assigned_to AS "assignedTo",
                   assignee.full_name AS "assignedToName",
                   admin.full_name AS "adminName"`
                       : ''
                   }
            FROM service_orders so
            JOIN service_types st ON st.service_type_id = so.service_type_id
            JOIN users u ON u.user_id = so.user_id
            LEFT JOIN plots p ON p.plot_id = so.plot_id
            ${
              admin
                ? `
            LEFT JOIN users assignee ON assignee.user_id = so.assigned_to
            LEFT JOIN users admin ON admin.user_id = so.admin_id`
                : ''
            }
            ${suffix}`;
  }
}
