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

export interface AppointmentRow extends QueryResultRow {
  id: number;
  reservationRequestId: number;
  customerId: number;
  customerName?: string | null;
  scheduledAt: Date | string;
  location: string;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  status: AppointmentStatus;
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
}

@Injectable()
export class AppointmentsService {
  private readonly allowedStatuses: AppointmentStatus[] = [
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
  ];

  constructor(private readonly database: DatabaseService) {}

  async create(adminId: number, dto: CreateAppointmentDto) {
    return this.database.transaction(async (client) => {
      const request = await this.lockApprovedReservationRequest(
        client,
        dto.reservationRequestId,
      );

      await this.assertNoScheduledAppointment(client, request.request_id);

      const appointment = await client.query<AppointmentRow>(
        `INSERT INTO offline_appointments (
           request_id, user_id, scheduled_at, location, assigned_staff_id,
           assigned_staff_name, note, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [
          request.request_id,
          request.user_id,
          dto.scheduledAt,
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
        'Lich hen ky hop dong da duoc tao',
        'Lich hen ky hop dong offline cua ban da duoc tao.',
        appointment.rows[0].id,
      );

      return { ...this.mapAppointment(appointment.rows[0]), notificationCreated: true };
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

  async adminList(filters: { status?: string; from?: string; to?: string }) {
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

    const rows = await this.database.query<AppointmentRow>(
      `${this.baseSelect()}
       WHERE ${clauses.join(' AND ')}
       ORDER BY oa.scheduled_at DESC`,
      params,
    );
    return rows.map((row) => this.mapAppointment(row));
  }

  async update(adminId: number, id: number, dto: UpdateAppointmentDto) {
    return this.database.transaction(async (client) => {
      const current = await this.lockAppointment(client, id);
      if (current.status !== 'scheduled') {
        throw new BadRequestException(
          'Only scheduled appointments can be updated',
        );
      }
      const updated = await client.query<AppointmentRow>(
        `UPDATE offline_appointments
         SET scheduled_at = COALESCE($2, scheduled_at),
             location = COALESCE($3, location),
             assigned_staff_id = COALESCE($4, assigned_staff_id),
             assigned_staff_name = COALESCE($5, assigned_staff_name),
             note = COALESCE($6, note),
             updated_by = $7
         WHERE appointment_id = $1 AND is_deleted = FALSE
         RETURNING appointment_id AS id, request_id AS "reservationRequestId",
                   user_id AS "customerId", scheduled_at AS "scheduledAt",
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [
          id,
          dto.scheduledAt ?? null,
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
        'Lich hen ky hop dong da duoc cap nhat',
        'Thong tin lich hen ky hop dong offline cua ban da duoc cap nhat.',
        id,
      );

      return { ...this.mapAppointment(updated.rows[0]), notificationCreated: true };
    });
  }

  async updateStatus(
    adminId: number,
    id: number,
    dto: UpdateAppointmentStatusDto,
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
                   location, assigned_staff_id AS "assignedStaffId",
                   assigned_staff_name AS "assignedStaffName", status, note,
                   status_note AS "statusNote", completed_at AS "completedAt",
                   cancelled_at AS "cancelledAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [id, dto.status, dto.statusNote ?? null, dto.note ?? null, adminId],
      );

      if (dto.status === 'completed') {
        await this.advanceExistingContractWorkflow(client, current.reservationRequestId);
      }

      await this.notify(
        client,
        current.customerId,
        'appointment_status_updated',
        'Trang thai lich hen da duoc cap nhat',
        'Trang thai lich hen ky hop dong offline cua ban da duoc cap nhat.',
        id,
      );

      return { ...this.mapAppointment(updated.rows[0]), notificationCreated: true };
    });
  }

  private async lockApprovedReservationRequest(
    client: PoolClient,
    requestId: number,
  ) {
    const result = await client.query<ReservationForAppointment>(
      `SELECT request_id, user_id, request_type, status
       FROM reservation_requests
       WHERE request_id = $1 AND is_deleted = FALSE
       FOR UPDATE`,
      [requestId],
    );
    const request = result.rows[0];
    if (!request) throw new NotFoundException('Reservation not found');
    if (request.status !== 'approved') {
      throw new BadRequestException(
        'Appointments can only be created for approved reservation requests',
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

  private async advanceExistingContractWorkflow(
    client: PoolClient,
    requestId: number,
  ) {
    await client.query(
      `UPDATE contracts
       SET notes = COALESCE(notes || E'\n', '') || 'Offline signing appointment completed.',
           updated_at = NOW()
       WHERE request_id = $1 AND is_deleted = FALSE`,
      [requestId],
    );
    await client.query(
      `UPDATE ownership_records own
       SET transfer_note = COALESCE(transfer_note || E'\n', '') || 'Offline signing appointment completed.'
       FROM contracts c
       WHERE own.contract_id = c.contract_id
         AND c.request_id = $1
         AND c.is_deleted = FALSE`,
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
                   oa.location,
                   oa.assigned_staff_id AS "assignedStaffId",
                   COALESCE(staff.full_name, oa.assigned_staff_name) AS "assignedStaffName",
                   oa.status,
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
