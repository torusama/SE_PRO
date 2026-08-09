import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { AdminServiceOrderQueryDto } from './dto/admin-service-order-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import {
  CompleteServiceOrderDto,
  SERVICE_ORDER_STATUSES,
  ServiceOrderPaymentStatus,
  ServiceOrderStatus,
  UpdateServiceOrderDto,
} from './dto/update-service-order.dto';
import { RealtimeService } from '../realtime/realtime.service';
import type { RealtimeTopic } from '../realtime/realtime.types';

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

interface ServiceOrderPaymentRow {
  order_id: number;
  user_id: number;
  status: ServiceOrderStatus;
  payment_status: ServiceOrderPaymentStatus;
  payment_code: string | null;
  amount: string;
  service_name: string;
}

@Injectable()
export class CemeteryServicesService {
  private readonly logger = new Logger(CemeteryServicesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly emailService: EmailService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

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

    let resolvedPlotId = dto.plotId;
    if (dto.deceasedProfileId !== undefined) {
      const profile = await this.database.queryOne<{ plot_id: number }>(
        `SELECT dp.plot_id FROM deceased_profiles dp
         WHERE dp.deceased_profile_id=$1 AND dp.is_deleted=FALSE
           AND (EXISTS(SELECT 1 FROM ownership_records o WHERE o.plot_id=dp.plot_id AND o.user_id=$2 AND o.is_current=TRUE)
             OR EXISTS(SELECT 1 FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id AND fm.is_active=TRUE
               JOIN family_groups fg ON fg.family_id=fm.family_id AND fg.status='active' AND fg.is_deleted=FALSE
               WHERE fm.user_id=$2 AND rp.resource_type='deceased_profile' AND rp.resource_id=dp.deceased_profile_id
                 AND rp.action='order_service' AND rp.revoked_at IS NULL))`,
        [dto.deceasedProfileId, userId],
      );
      if (!profile)
        throw new ForbiddenException(
          'Bạn không có quyền đặt dịch vụ cho hồ sơ này',
        );
      if (resolvedPlotId !== undefined && resolvedPlotId !== profile.plot_id)
        throw new BadRequestException('Hồ sơ không thuộc lô đã chọn');
      resolvedPlotId = profile.plot_id;
    }
    if (resolvedPlotId !== undefined && dto.deceasedProfileId === undefined) {
      const ownedPlot = await this.database.queryOne(
        `SELECT 1
         FROM ownership_records o
         JOIN plots p ON p.plot_id = o.plot_id AND p.is_deleted = FALSE
         JOIN contracts c ON c.contract_id = o.contract_id
                          AND c.status = 'active' AND c.is_deleted = FALSE
         WHERE o.user_id = $1 AND o.plot_id = $2 AND o.is_current = TRUE`,
        [userId, resolvedPlotId],
      );
      if (!ownedPlot) {
        throw new ForbiddenException(
          'Bạn chỉ có thể đặt dịch vụ cho lô thuộc quyền sử dụng của mình',
        );
      }
    }

    const order = await this.database.transaction(async (client) => {
      const idempotencyKey = [
        userId,
        resolvedPlotId ?? 'none',
        dto.serviceTypeId,
        dto.requestedDate ?? 'none',
      ].join(':');
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [idempotencyKey],
      );
      const duplicate = await client.query(
        `SELECT order_id AS id, status, amount::float
         FROM service_orders
         WHERE user_id = $1
           AND plot_id IS NOT DISTINCT FROM $2
           AND service_type_id = $3
           AND requested_date IS NOT DISTINCT FROM $4::date
           AND status IN ('submitted', 'pending_confirm', 'confirmed', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          userId,
          resolvedPlotId ?? null,
          dto.serviceTypeId,
          dto.requestedDate ?? null,
        ],
      );
      if (duplicate.rows[0]) {
        return { ...duplicate.rows[0], reused: true };
      }

      const result = await client.query(
        `INSERT INTO service_orders
           (user_id, plot_id, deceased_profile_id, service_type_id, unit_price, amount, requested_date, note)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
         RETURNING order_id AS id, status, amount::float`,
        [
          userId,
          resolvedPlotId ?? null,
          dto.deceasedProfileId ?? null,
          dto.serviceTypeId,
          type.base_price,
          dto.requestedDate ?? null,
          dto.note ?? null,
        ],
      );
      const newOrder = result.rows[0];

      await client.query(
        `INSERT INTO service_order_history
           (order_id, changed_by, action, new_status, note)
         VALUES ($1, $2, 'submitted', 'submitted', $3)`,
        [newOrder.id, userId, dto.note ?? null],
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
        [newOrder.id, type.name],
      );
      return { ...newOrder, reused: false };
    });

    // Chỉ gửi email xác nhận cho đơn thực sự mới vừa tạo (không gửi lại khi
    // là đơn trùng được tái sử dụng). Gửi sau khi transaction đã commit và
    // không để lỗi gửi mail làm hỏng luồng đặt dịch vụ của khách.
    if (!order.reused) {
      this.publishRealtime(['services', 'notifications', 'dashboard']);

      void this.sendOrderConfirmationEmail(userId, {
        serviceName: type.name,
        plotCode: dto.plotId ? await this.plotCodeOf(dto.plotId) : null,
        requestedDate: dto.requestedDate ?? null,
        amount: Number(type.base_price),
        orderId: order.id,
      });
    }

    return order;
  }

  private async plotCodeOf(plotId: number) {
    const row = await this.database.queryOne<{ plot_code: string }>(
      `SELECT plot_code FROM plots WHERE plot_id = $1`,
      [plotId],
    );
    return row?.plot_code ?? null;
  }

  private async sendOrderConfirmationEmail(
    userId: number,
    params: {
      serviceName: string;
      plotCode?: string | null;
      requestedDate?: string | null;
      amount: number;
      orderId: number;
    },
  ) {
    try {
      const user = await this.database.queryOne<{ email: string | null }>(
        `SELECT email FROM users WHERE user_id = $1`,
        [userId],
      );
      if (!user?.email) return;
      await this.emailService.sendServiceOrderConfirmationEmail(
        user.email,
        params,
      );
    } catch (err) {
      this.logger.error(
        `Gửi email xác nhận đặt dịch vụ thất bại (order #${params.orderId}): ${(err as Error).message}`,
      );
    }
  }

  myOrders(userId: number) {
    return this.orders('WHERE so.user_id = $1 ORDER BY so.created_at DESC', [
      userId,
    ]);
  }

  async adminOrders(
    query: AdminServiceOrderQueryDto = new AdminServiceOrderQueryDto(),
  ) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(u.full_name ILIKE ${p} OR st.name ILIKE ${p} OR p.plot_code ILIKE ${p})`,
      );
    }
    if (query.status) conditions.push(`so.status=${add(query.status)}`);
    if (query.assigneeId)
      conditions.push(`so.assigned_to=${add(query.assigneeId)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM service_orders so
       JOIN users u ON u.user_id=so.user_id
       JOIN service_types st ON st.service_type_id=so.service_type_id
       LEFT JOIN plots p ON p.plot_id=so.plot_id ${where}`,
      values,
    );
    values.push(query.pageSize, query.offset);
    const items = await this.orders(
      `${where} ORDER BY so.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
      true,
    );
    return paginate(
      items,
      Number(count?.total ?? 0),
      query.page,
      query.pageSize,
    );
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
      const history = await this.database.query(
        `SELECT h.history_id AS id, h.action,
                h.previous_status AS "previousStatus",
                h.new_status AS "newStatus",
                h.created_at AS "createdAt"
         FROM service_order_history h
         WHERE h.order_id = $1
           AND (
             h.action IN ('submitted', 'completed', 'payment_reported', 'payment_confirmed')
             OR h.new_status IS DISTINCT FROM h.previous_status
           )
         ORDER BY h.created_at ASC, h.history_id ASC`,
        [id],
      );
      return { ...order, history };
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

    this.publishRealtime(['services', 'notifications', 'dashboard']);

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

    // Gửi email cho khách hàng kèm ảnh + nội dung hoàn thành, sau khi
    // transaction đã commit. Không throw khi lỗi gửi mail (SMTP chưa cấu
    // hình, v.v.) để không làm hỏng thao tác hoàn thành đơn của admin.
    this.publishRealtime(['services', 'notifications', 'dashboard']);
    void this.sendCompletionEmail(id, files);

    return this.one(id);
  }

  private async sendCompletionEmail(orderId: number, files: Express.Multer.File[]) {
    try {
      const order = await this.database.queryOne<{
        email: string | null;
        service_name: string;
        completion_note: string | null;
        completed_at: string;
      }>(
        `SELECT u.email, st.name AS service_name, so.completion_note, so.completed_at
         FROM service_orders so
         JOIN users u ON u.user_id = so.user_id
         JOIN service_types st ON st.service_type_id = so.service_type_id
         WHERE so.order_id = $1`,
        [orderId],
      );
      if (!order?.email) return;

      const attachments = files.map((file) => ({
        filename: file.filename,
        path: join(process.cwd(), 'uploads', 'service-completions', file.filename),
      }));

      await this.emailService.sendServiceOrderCompletionEmail(order.email, {
        orderId,
        serviceName: order.service_name,
        completionNote: order.completion_note,
        completedAt: order.completed_at,
        attachments,
      });
    } catch (err) {
      this.logger.error(
        `Gửi email hoàn thành dịch vụ thất bại (order #${orderId}): ${(err as Error).message}`,
      );
    }
  }

  /** Khách hàng bấm "Tôi đã thanh toán" trên đơn đang ở trạng thái 'confirmed'.
   * Chỉ ghi nhận đơn đang chờ admin duyệt xác nhận đã nhận tiền — KHÔNG tự
   * đổi status của đơn (status vẫn 'confirmed' cho tới khi admin xác nhận). */
  async markPaid(id: number, userId: number) {
    const changed = await this.database.transaction(async (client) => {
      const currentResult = await client.query<ServiceOrderPaymentRow>(
        `SELECT so.order_id, so.user_id, so.status, so.payment_status,
                so.payment_code, so.amount::text AS amount,
                st.name AS service_name
         FROM service_orders so
         JOIN service_types st ON st.service_type_id = so.service_type_id
         WHERE so.order_id = $1 AND so.is_deleted = FALSE
         FOR UPDATE OF so`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ');
      if (current.user_id !== userId) {
        throw new ForbiddenException('Bạn không có quyền thao tác đơn này');
      }
      if (current.status !== 'confirmed') {
        throw new BadRequestException(
          'Chỉ có thể thanh toán khi đơn đã được xác nhận',
        );
      }
      if (current.payment_status === 'paid') {
        throw new BadRequestException('Đơn này đã được xác nhận thanh toán');
      }
      // Đã báo thanh toán trước đó rồi (đang chờ admin duyệt) -> idempotent,
      // không tạo thêm lịch sử/thông báo trùng lặp.
      if (current.payment_status === 'awaiting_confirmation') {
        return false;
      }

      const paymentCode =
        current.payment_code ??
        `VPV${String(id).padStart(5, '0')}${randomUUID().slice(0, 4).toUpperCase()}`;

      await client.query(
        `UPDATE service_orders
         SET payment_status = 'awaiting_confirmation', payment_code = $2,
             paid_at = NOW(), updated_at = NOW()
         WHERE order_id = $1`,
        [id, paymentCode],
      );

      await client.query(
        `INSERT INTO service_order_history
           (order_id, changed_by, action, previous_status, new_status, note)
         VALUES ($1, $2, 'payment_reported', $3, $3, 'Khách hàng báo đã thanh toán')`,
        [id, userId, current.status],
      );

      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_entity_type, related_entity_id)
         SELECT user_id, 'service_payment_reported', 'Khách báo đã thanh toán',
                CONCAT('Khách hàng báo đã thanh toán đơn dịch vụ "', $2::text,
                       '", đang chờ xác nhận.'),
                'service_order', $1
         FROM users
         WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
        [id, current.service_name],
      );

      return true;
    });

    if (changed) {
      this.publishRealtime(['services', 'notifications', 'dashboard']);
    }

    return this.one(id, userId);
  }

  /** Admin bấm "Xác nhận đã nhận thanh toán". Đơn sẽ tự động chuyển từ
   * 'confirmed' sang 'in_progress' luôn (nếu đơn vẫn đang ở 'confirmed'),
   * để hiển thị "Đã thanh toán - đang thực hiện" như yêu cầu. */
  async confirmPayment(id: number, adminId: number) {
    await this.database.transaction(async (client) => {
      const currentResult = await client.query<ServiceOrderPaymentRow>(
        `SELECT so.order_id, so.user_id, so.status, so.payment_status,
                so.payment_code, so.amount::text AS amount,
                st.name AS service_name
         FROM service_orders so
         JOIN service_types st ON st.service_type_id = so.service_type_id
         WHERE so.order_id = $1 AND so.is_deleted = FALSE
         FOR UPDATE OF so`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ');
      if (current.payment_status !== 'awaiting_confirmation') {
        throw new BadRequestException(
          'Chỉ có thể xác nhận khi khách hàng đã báo thanh toán',
        );
      }

      const nextStatus: ServiceOrderStatus =
        current.status === 'confirmed' ? 'in_progress' : current.status;

      await client.query(
        `UPDATE service_orders
         SET payment_status = 'paid', payment_confirmed_at = NOW(),
             payment_confirmed_by = $2, status = $3, updated_at = NOW()
         WHERE order_id = $1`,
        [id, adminId, nextStatus],
      );

      await client.query(
        `INSERT INTO service_order_history
           (order_id, changed_by, action, previous_status, new_status, note)
         VALUES ($1, $2, 'payment_confirmed', $3, $4, 'Admin xác nhận đã nhận thanh toán')`,
        [id, adminId, current.status, nextStatus],
      );

      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'service_payment_confirmed', 'Đã xác nhận thanh toán',
                 CONCAT('Đơn dịch vụ "', $3::text,
                        '" đã được xác nhận thanh toán và đang được thực hiện.'),
                 'service_order', $2)`,
        [current.user_id, id, current.service_name],
      );
    });

    this.publishRealtime(['services', 'notifications', 'dashboard']);

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

  private publishRealtime(topics: readonly RealtimeTopic[]) {
    try {
      this.realtime?.publish(topics, ['authenticated']);
    } catch (error) {
      this.logger.warn(
        `Realtime service-order publication failed: ${(error as Error).message}`,
      );
    }
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
                   so.payment_status AS "paymentStatus",
                   so.payment_code AS "paymentCode",
                   so.paid_at AS "paidAt",
                   so.payment_confirmed_at AS "paymentConfirmedAt",
                   st.name AS "serviceName", st.category,
                   p.plot_code AS "plotCode",
                   u.full_name AS "customerName",
                   assignee.full_name AS "assignedToName"
                   ${
                     admin
                       ? `,
                   u.email AS "customerEmail",
                   u.phone_number AS "customerPhone",
                   so.admin_note AS "adminNote",
                   so.assigned_to AS "assignedTo",
                   admin.full_name AS "adminName"`
                       : ''
                   }
            FROM service_orders so
            JOIN service_types st ON st.service_type_id = so.service_type_id
            JOIN users u ON u.user_id = so.user_id
            LEFT JOIN plots p ON p.plot_id = so.plot_id
            LEFT JOIN users assignee ON assignee.user_id = so.assigned_to
            ${
              admin
                ? `
            LEFT JOIN users admin ON admin.user_id = so.admin_id`
                : ''
            }
            ${suffix}`;
  }
}
