import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentStatus,
  UpdateAppointmentStatusDto,
} from './dto/update-appointment-status.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminAppointmentQueryDto } from './dto/admin-appointment-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import type { AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';
import { RespondAppointmentDto } from './dto/respond-appointment.dto';

const vietnamDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const vietnamDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

export interface AppointmentRow extends QueryResultRow {
  id: number;
  reservationRequestId: number;
  customerId: number;
  customerName?: string | null;
  scheduledAt: Date | string;
  scheduledEndAt: Date | string;
  location: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  status: AppointmentStatus;
  customerStatus: 'pending' | 'confirmed' | 'declined';
  customerRespondedAt: Date | string | null;
  customerSelectedAt: Date | string | null;
  note: string | null;
  statusNote: string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ReservationForAppointment extends QueryResultRow {
  request_id: number;
  user_id: number;
  request_type: string;
  status: string;
  cancellationPending?: boolean;
}

@Injectable()
export class AppointmentsService {
  private readonly allowedStatuses: AppointmentStatus[] = [
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
  ];

  constructor(
    private readonly database: DatabaseService,
    private readonly audit?: AdminAuditService,
  ) {}

  async create(
    adminId: number,
    dto: CreateAppointmentDto,
    context?: AdminRequestContext,
  ) {
    this.assertValidTimeRange(dto.scheduledAt, dto.scheduledEndAt);
    this.assertAppointmentDateNotInPast(dto.scheduledAt);
    return this.database.transaction(async (client) => {
      const request = await this.lockApprovedReservationRequest(
        client,
        dto.reservationRequestId,
      );

      await this.assertNoScheduledAppointment(client, request.request_id);

      const appointment = await client.query<AppointmentRow>(
        `INSERT INTO offline_appointments (
           request_id, user_id, scheduled_at, scheduled_end_at, location,
           assigned_staff_id, assigned_staff_name, note, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   scheduled_end_at AS "scheduledEndAt",
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   customer_status AS "customerStatus",
                   customer_responded_at AS "customerRespondedAt",
                   customer_selected_at AS "customerSelectedAt",
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [
          request.request_id,
          request.user_id,
          dto.scheduledAt,
          dto.scheduledEndAt,
          dto.location,
          dto.assignedStaffId ?? null,
          dto.assignedStaffName ?? null,
          dto.note ?? null,
          adminId,
        ],
      );

      await this.notify(
        client,
        request.user_id,
        'appointment_created',
        'Lịch hẹn offline cần xác nhận',
        'Vui lòng xác nhận hoặc từ chối khoảng ngày lịch hẹn do quản trị viên đề xuất.',
        appointment.rows[0].id,
      );
      await this.audit?.record(client, {
        action: 'appointment.create',
        entityType: 'offline_appointment',
        entityId: appointment.rows[0].id,
        after: appointment.rows[0],
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });

      return {
        ...this.mapAppointment(appointment.rows[0]),
        notificationCreated: true,
      };
    });
  }

  async my(userId: number, status?: string) {
    this.assertOptionalStatus(status);
    const params: unknown[] = [userId];
    const statusClause = status ? 'AND oa.status = $2' : '';
    if (status) params.push(status);
    const rows = await this.database.query<AppointmentRow>(
      `${this.baseSelect()}
       WHERE oa.user_id = $1 AND oa.is_deleted = FALSE ${statusClause}
       ORDER BY oa.scheduled_at DESC`,
      params,
    );
    return rows.map((row) => this.mapAppointment(row));
  }

  async adminList(filters: AdminAppointmentQueryDto) {
    this.assertOptionalStatus(filters.status);
    const params: unknown[] = [];
    const clauses = ['oa.is_deleted = FALSE'];
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`oa.status = $${params.length}`);
    }
    if (filters.from) {
      params.push(filters.from);
      clauses.push(`oa.scheduled_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      clauses.push(`oa.scheduled_at <= $${params.length}`);
    }

    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM offline_appointments oa
       WHERE ${clauses.join(' AND ')}`,
      params,
    );
    params.push(filters.pageSize, filters.offset);
    const rows = await this.database.query<AppointmentRow>(
      `${this.baseSelect()}
       WHERE ${clauses.join(' AND ')}
       ORDER BY oa.scheduled_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return paginate(
      rows.map((row) => this.mapAppointment(row)),
      Number(count?.total ?? 0),
      filters.page,
      filters.pageSize,
    );
  }

  async update(
    adminId: number,
    id: number,
    dto: UpdateAppointmentDto,
    context?: AdminRequestContext,
  ) {
    return this.database.transaction(async (client) => {
      const current = await this.lockAppointment(client, id);
      if (current.status !== 'scheduled') {
        throw new BadRequestException(
          'Only scheduled appointments can be updated',
        );
      }
      this.assertValidTimeRange(
        dto.scheduledAt ?? String(current.scheduledAt),
        dto.scheduledEndAt ?? String(current.scheduledEndAt),
      );
      if (dto.scheduledAt) {
        this.assertAppointmentDateNotInPast(dto.scheduledAt);
      }
      const updated = await client.query<AppointmentRow>(
        `UPDATE offline_appointments
         SET scheduled_at = COALESCE($2, scheduled_at),
             scheduled_end_at = COALESCE($3, scheduled_end_at),
             location = COALESCE($4, location),
             assigned_staff_id = COALESCE($5, assigned_staff_id),
             assigned_staff_name = COALESCE($6, assigned_staff_name),
             note = COALESCE($7, note),
             customer_status = 'pending',
             customer_responded_at = NULL,
             customer_selected_at = NULL,
             updated_by = $8
         WHERE appointment_id = $1 AND is_deleted = FALSE
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   scheduled_end_at AS "scheduledEndAt",
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   customer_status AS "customerStatus",
                   customer_responded_at AS "customerRespondedAt",
                   customer_selected_at AS "customerSelectedAt",
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [
          id,
          dto.scheduledAt ?? null,
          dto.scheduledEndAt ?? null,
          dto.location ?? null,
          dto.assignedStaffId ?? null,
          dto.assignedStaffName ?? null,
          dto.note ?? null,
          adminId,
        ],
      );

      await this.notify(
        client,
        current.customerId,
        'appointment_updated',
        'Lịch hẹn offline đã được cập nhật',
        'Vui lòng xác nhận lại khoảng ngày lịch hẹn mới.',
        id,
      );
      await this.audit?.record(client, {
        action: 'appointment.update',
        entityType: 'offline_appointment',
        entityId: id,
        before: current,
        after: updated.rows[0],
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });

      return {
        ...this.mapAppointment(updated.rows[0]),
        notificationCreated: true,
      };
    });
  }

  async respond(userId: number, id: number, dto: RespondAppointmentDto) {
    return this.database.transaction(async (client) => {
      const result = await client.query<AppointmentRow>(
        `${this.baseSelect()}
         WHERE oa.appointment_id = $1 AND oa.user_id = $2
           AND oa.is_deleted = FALSE
         FOR UPDATE OF oa`,
        [id, userId],
      );
      const current = result.rows[0];
      if (!current) throw new NotFoundException('Appointment not found');
      if (
        current.status !== 'scheduled' ||
        current.customerStatus !== 'pending'
      ) {
        throw new BadRequestException(
          'This appointment no longer needs a response',
        );
      }
      if (dto.status === 'confirmed') {
        this.assertCustomerSelectedTime(current, dto.selectedAt);
      }

      const updated = await client.query<AppointmentRow>(
        `UPDATE offline_appointments
         SET customer_status = $3::varchar,
             customer_responded_at = NOW(),
             customer_selected_at = CASE
               WHEN $3::varchar = 'confirmed' THEN $5::timestamptz
               ELSE NULL
             END,
             status = CASE WHEN $3::varchar = 'declined' THEN 'cancelled' ELSE status END,
             cancelled_at = CASE WHEN $3::varchar = 'declined' THEN NOW() ELSE cancelled_at END,
             status_note = CASE
               WHEN $3::varchar = 'declined' THEN COALESCE(NULLIF($4::varchar, ''), 'Khách hàng từ chối lịch hẹn')
               ELSE status_note
             END,
             updated_at = NOW()
         WHERE appointment_id = $1 AND user_id = $2 AND is_deleted = FALSE
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   scheduled_end_at AS "scheduledEndAt", location,
                   assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   customer_status AS "customerStatus",
                   customer_responded_at AS "customerRespondedAt",
                   customer_selected_at AS "customerSelectedAt",
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [id, userId, dto.status, dto.note ?? null, dto.selectedAt ?? null],
      );
      const selectedTimeMessage =
        dto.status === 'confirmed' && dto.selectedAt
          ? ` vào ${vietnamDateTimeFormatter.format(new Date(dto.selectedAt))}`
          : '';
      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_entity_type, related_entity_id)
         SELECT user_id, 'appointment_response', $1, $2,
                'offline_appointment', $3
         FROM users
         WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
        [
          dto.status === 'confirmed'
            ? 'Khách hàng đã xác nhận lịch hẹn'
            : 'Khách hàng đã từ chối lịch hẹn',
          `${current.customerName ?? 'Khách hàng'} đã ${
            dto.status === 'confirmed' ? 'xác nhận' : 'từ chối'
          } lịch hẹn offline${selectedTimeMessage}.`,
          id,
        ],
      );

      // Khi khách hàng chọn giờ hẹn cụ thể, lịch hẹn ký kết mua đất coi như đã
      // được chốt giữa hai bên (khách hàng và ban quản lý). Gửi thêm một thông
      // báo riêng cho khách hàng, nhắc họ mang theo giấy tờ cần thiết khi đến
      // buổi ký kết, để tránh việc khách đến nơi mà thiếu giấy tờ.
      if (dto.status === 'confirmed' && dto.selectedAt) {
        await this.notify(
          client,
          userId,
          'appointment_confirmed',
          'Lịch hẹn ký kết mua đất đã được chốt',
          this.buildPurchaseAppointmentConfirmedMessage(
            dto.selectedAt,
            current.location,
          ),
          id,
        );
      }
      return this.mapAppointment(updated.rows[0]);
    });
  }

  async updateStatus(
    adminId: number,
    id: number,
    dto: UpdateAppointmentStatusDto,
    context?: AdminRequestContext,
  ) {
    return this.database.transaction(async (client) => {
      const current = await this.lockAppointment(client, id);
      if (current.status !== 'scheduled') {
        throw new BadRequestException(
          'Only scheduled appointments can change status',
        );
      }
      if (
        ['cancelled', 'no_show'].includes(dto.status) &&
        !dto.statusNote?.trim()
      ) {
        throw new BadRequestException(
          'A status note is required for cancelled or no-show appointments',
        );
      }

      const updated = await client.query<AppointmentRow>(
        `UPDATE offline_appointments
         SET status = $2,
             status_note = COALESCE($3, status_note),
             note = COALESCE($4, note),
             completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
             cancelled_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE cancelled_at END,
             updated_by = $5
         WHERE appointment_id = $1 AND is_deleted = FALSE
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   scheduled_end_at AS "scheduledEndAt",
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   customer_status AS "customerStatus",
                   customer_responded_at AS "customerRespondedAt",
                   customer_selected_at AS "customerSelectedAt",
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [id, dto.status, dto.statusNote ?? null, dto.note ?? null, adminId],
      );

      if (dto.status === 'completed') {
        await this.markContractsAwaitingSignedEvidence(
          client,
          current.reservationRequestId,
        );
      }

      await this.notify(
        client,
        current.customerId,
        'appointment_status_updated',
        'Trang thai lich hen da duoc cap nhat',
        'Trang thai lich hen ky hop dong offline cua ban da duoc cap nhat.',
        id,
      );
      await this.audit?.record(client, {
        action: 'appointment.status.update',
        entityType: 'offline_appointment',
        entityId: id,
        before: { status: current.status },
        after: {
          status: updated.rows[0].status,
          statusNote: updated.rows[0].statusNote,
        },
        context: context ?? { adminId, ipAddress: null, userAgent: null },
      });

      return {
        ...this.mapAppointment(updated.rows[0]),
        notificationCreated: true,
      };
    });
  }

  private async lockApprovedReservationRequest(
    client: PoolClient,
    requestId: number,
  ) {
    const result = await client.query<ReservationForAppointment>(
      `SELECT request_id, user_id, request_type, status,
               EXISTS (
                 SELECT 1 FROM purchase_request_cancellations cancellation
                 WHERE cancellation.request_id = reservation_requests.request_id
                   AND cancellation.status = 'pending'
               ) AS "cancellationPending"
        FROM reservation_requests
        WHERE request_id = $1 AND request_type = 'purchase'
          AND is_deleted = FALSE
       FOR UPDATE`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request || request.request_type !== 'purchase') {
      throw new NotFoundException('Purchase request not found');
    }
    if (request.status !== 'approved') {
      throw new BadRequestException(
        'Appointments can only be created for approved reservation requests',
      );
    }
    if (request.cancellationPending) {
      throw new BadRequestException(
        'Cannot create an appointment while a purchase cancellation is pending review',
      );
    }
    return request;
  }

  private async assertNoScheduledAppointment(
    client: PoolClient,
    requestId: number,
  ) {
    const result = await client.query(
      `SELECT appointment_id
       FROM offline_appointments
       WHERE request_id = $1 AND status = 'scheduled' AND is_deleted = FALSE
       FOR UPDATE`,
      [requestId],
    );
    if (result.rows.length) {
      throw new BadRequestException(
        'A scheduled appointment already exists for this reservation',
      );
    }
  }

  private async lockAppointment(client: PoolClient, id: number) {
    const result = await client.query<AppointmentRow>(
      `${this.baseSelect()}
       WHERE oa.appointment_id = $1 AND oa.is_deleted = FALSE
       FOR UPDATE OF oa`,
      [id],
    );
    const appointment = result.rows[0];
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private async markContractsAwaitingSignedEvidence(
    client: PoolClient,
    requestId: number,
  ) {
    await client.query(
      `UPDATE contracts
       SET notes = COALESCE(notes || E'\n', '') ||
             'Offline signing appointment completed; awaiting signed evidence verification.',
           updated_at = NOW()
       WHERE request_id = $1 AND status = 'draft' AND is_deleted = FALSE`,
      [requestId],
    );
  }

  private assertOptionalStatus(status?: string) {
    if (status && !this.allowedStatuses.includes(status as AppointmentStatus)) {
      throw new BadRequestException('Invalid appointment status');
    }
  }

  private baseSelect() {
    return `SELECT oa.appointment_id AS id,
                   oa.request_id AS "reservationRequestId",
                   oa.user_id AS "customerId",
                   u.full_name AS "customerName",
                   oa.scheduled_at AS "scheduledAt",
                   oa.scheduled_end_at AS "scheduledEndAt",
                   oa.location,
                   oa.assigned_staff_id AS "assignedStaffId",
                   COALESCE(staff.full_name, oa.assigned_staff_name) AS "assignedStaffName",
                   oa.status,
                   oa.customer_status AS "customerStatus",
                   oa.customer_responded_at AS "customerRespondedAt",
                   oa.customer_selected_at AS "customerSelectedAt",
                   oa.note,
                   oa.status_note AS "statusNote",
                   oa.completed_at AS "completedAt",
                   oa.cancelled_at AS "cancelledAt",
                   oa.created_at AS "createdAt",
                   oa.updated_at AS "updatedAt"
            FROM offline_appointments oa
            JOIN users u ON u.user_id = oa.user_id
            LEFT JOIN users staff ON staff.user_id = oa.assigned_staff_id`;
  }

  private mapAppointment(row: AppointmentRow) {
    return row;
  }

  private assertValidTimeRange(start: string, end: string) {
    const startAt = new Date(start);
    const endAt = new Date(end);
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt.getTime() <= startAt.getTime()
    ) {
      throw new BadRequestException(
        'Appointment end time must be after start time',
      );
    }
  }

  private assertAppointmentDateNotInPast(value: string) {
    const appointmentDate = new Date(value);
    const dateKey = (date: Date) => {
      const parts = vietnamDateFormatter.formatToParts(date);
      const part = (type: 'year' | 'month' | 'day') =>
        Number(parts.find((item) => item.type === type)?.value ?? 0);
      return part('year') * 10_000 + part('month') * 100 + part('day');
    };
    if (dateKey(appointmentDate) < dateKey(new Date())) {
      throw new BadRequestException(
        'Appointment date cannot be earlier than the current date',
      );
    }
  }

  private assertCustomerSelectedTime(
    appointment: AppointmentRow,
    selectedAt?: string,
  ) {
    if (!selectedAt) {
      throw new BadRequestException(
        'Select an exact meeting date and time before confirming',
      );
    }
    const selected = new Date(selectedAt);
    const start = new Date(appointment.scheduledAt);
    const end = new Date(appointment.scheduledEndAt);
    if (
      Number.isNaN(selected.getTime()) ||
      selected < start ||
      selected > end
    ) {
      throw new BadRequestException(
        'Selected meeting time must be within the proposed date range',
      );
    }
    if (selected <= new Date()) {
      throw new BadRequestException(
        'Selected meeting time must be in the future',
      );
    }
  }

  /**
   * Nội dung thông báo gửi cho khách hàng khi lịch hẹn ký kết mua đất đã được
   * chốt (khách hàng đã chọn giờ hẹn cụ thể trong khoảng thời gian do quản trị
   * viên đề xuất). Nhắc khách chuẩn bị giấy tờ cần mang theo khi đến ký kết.
   */
  private buildPurchaseAppointmentConfirmedMessage(
    selectedAt: string,
    location: string,
  ): string {
    const whenText = vietnamDateTimeFormatter.format(new Date(selectedAt));
    return [
      `Lịch hẹn ký kết hợp đồng mua đất của bạn đã được chốt vào ${whenText}, tại ${location}.`,
      'Vui lòng chuẩn bị đầy đủ giấy tờ sau và mang theo khi đến buổi ký kết:',
      '• CCCD/Thẻ căn cước của người đứng tên',
      '• Phiếu xác nhận đặt mua/đặt chỗ (nếu có)',
      '• Thông tin liên hệ',
      '• Thông tin thanh toán theo thỏa thuận',
      '• Giấy ủy quyền nếu người ký không trực tiếp đứng tên',
      'Vui lòng mang theo bản gốc để đối chiếu khi ký kết.',
    ].join('\n');
  }

  private async notify(
    client: PoolClient,
    userId: number,
    type: string,
    title: string,
    message: string,
    appointmentId: number,
  ) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, 'offline_appointment', $5)`,
      [userId, type, title, message, appointmentId],
    );
  }
}
