import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';

export interface SlotRow {
  id: number;
  userId: number;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  isActive: boolean;
}

const SLOT_SELECT = `
  slot_id AS id, user_id AS "userId", day_of_week AS "dayOfWeek",
  specific_date AS "specificDate", start_time AS "startTime",
  end_time AS "endTime", is_recurring AS "isRecurring",
  is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
`;

const APPOINTMENT_SELECT = `
  a.appointment_id AS id, a.slot_id AS "slotId", a.host_user_id AS "hostUserId",
  a.requester_id AS "requesterId", a.appointment_date AS "appointmentDate",
  a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.note,
  a.created_at AS "createdAt",
  host.full_name AS "hostName", requester.full_name AS "requesterName"
`;

@Injectable()
export class ScheduleService {
  constructor(private readonly database: DatabaseService) {}

  // ---------------------------------------------------------------------
  // Availability slots
  // ---------------------------------------------------------------------

  async createSlot(userId: number, dto: CreateAvailabilitySlotDto) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const slot = await this.database.queryOne<SlotRow>(
      `INSERT INTO availability_slots
         (user_id, day_of_week, specific_date, start_time, end_time, is_recurring)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SLOT_SELECT}`,
      [
        userId,
        dto.isRecurring ? dto.dayOfWeek : null,
        dto.isRecurring ? null : dto.specificDate,
        dto.startTime,
        dto.endTime,
        dto.isRecurring,
      ],
    );
    return slot;
  }

  async listMySlots(userId: number) {
    return this.database.query<SlotRow>(
      `SELECT ${SLOT_SELECT}
       FROM availability_slots
       WHERE user_id = $1
       ORDER BY is_recurring DESC, day_of_week, specific_date, start_time`,
      [userId],
    );
  }

  async listUserSlots(userId: number) {
    return this.database.query<SlotRow>(
      `SELECT ${SLOT_SELECT}
       FROM availability_slots
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY is_recurring DESC, day_of_week, specific_date, start_time`,
      [userId],
    );
  }

  async listAvailableHosts(currentUserId: number) {
    return this.database.query(
      `SELECT u.user_id AS id, u.full_name AS "fullName", LOWER(u.role) AS role
       FROM users u
       WHERE u.user_id <> $1 AND LOWER(u.role) = 'admin'
         AND u.is_active = TRUE AND u.is_deleted = FALSE
       ORDER BY u.full_name`,
      [currentUserId],
    );
  }

  async updateSlot(userId: number, id: number, dto: UpdateAvailabilitySlotDto) {
    const owned = await this.getOwnedSlot(userId, id);
    const startTime = dto.startTime ?? owned.startTime;
    const endTime = dto.endTime ?? owned.endTime;
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const slot = await this.database.queryOne<SlotRow>(
      `UPDATE availability_slots
       SET start_time = $3, end_time = $4,
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE slot_id = $1 AND user_id = $2
       RETURNING ${SLOT_SELECT}`,
      [id, userId, startTime, endTime, dto.isActive ?? null],
    );
    if (!slot) throw new NotFoundException('Slot not found');
    return slot;
  }

  async deleteSlot(userId: number, id: number) {
    await this.getOwnedSlot(userId, id);
    const upcoming = await this.database.queryOne(
      `SELECT appointment_id FROM schedule_appointments
       WHERE slot_id = $1 AND status IN ('pending', 'confirmed')
         AND appointment_date >= CURRENT_DATE
       LIMIT 1`,
      [id],
    );
    if (upcoming) {
      throw new BadRequestException(
        'Cannot delete a slot with upcoming pending/confirmed appointments. Cancel them first.',
      );
    }
    await this.database.query(
      `DELETE FROM availability_slots WHERE slot_id = $1 AND user_id = $2`,
      [id, userId],
    );
    return { deleted: true };
  }

  private async getOwnedSlot(userId: number, id: number): Promise<SlotRow> {
    const slot = await this.database.queryOne<SlotRow>(
      `SELECT ${SLOT_SELECT} FROM availability_slots WHERE slot_id = $1`,
      [id],
    );
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.userId !== userId) {
      throw new ForbiddenException('You do not own this slot');
    }
    return slot;
  }

  // ---------------------------------------------------------------------
  // Appointments
  // ---------------------------------------------------------------------

  async bookAppointment(requesterId: number, dto: BookAppointmentDto) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (dto.hostUserId === requesterId) {
      throw new BadRequestException('Cannot book an appointment with yourself');
    }

    return this.database.transaction(async (client) => {
      let hostUserId = dto.hostUserId;
      if (!hostUserId) {
        const admin = await client.query(
          `SELECT user_id FROM users
           WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE
           ORDER BY user_id LIMIT 1`,
        );
        if (!admin.rows.length) {
          throw new BadRequestException(
            'No active admin is available to receive this request',
          );
        }
        hostUserId = admin.rows[0].user_id;
      }

      const host = await client.query(
        `SELECT user_id FROM users WHERE user_id = $1 AND is_deleted = FALSE AND is_active = TRUE`,
        [hostUserId],
      );
      if (!host.rows.length) throw new NotFoundException('Host user not found');

      if (dto.slotId) {
        const slot = await client.query(
          `SELECT slot_id FROM availability_slots
           WHERE slot_id = $1 AND user_id = $2 AND is_active = TRUE`,
          [dto.slotId, requesterId],
        );
        if (!slot.rows.length) {
          throw new BadRequestException(
            'Availability slot does not belong to the requester',
          );
        }
      }

      // Prevent double-booking: lock overlapping rows for this host/date first.
      const overlap = await client.query(
        `SELECT appointment_id FROM schedule_appointments
         WHERE host_user_id = $1 AND appointment_date = $2
           AND status IN ('pending', 'confirmed')
           AND start_time < $4 AND end_time > $3
         FOR UPDATE`,
        [hostUserId, dto.appointmentDate, dto.startTime, dto.endTime],
      );
      if (overlap.rows.length) {
        throw new BadRequestException(
          'Host already has an appointment in that time range',
        );
      }

      const inserted = await client.query(
        `INSERT INTO schedule_appointments
           (slot_id, host_user_id, requester_id, appointment_date, start_time, end_time, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING appointment_id AS id`,
        [
          dto.slotId ?? null,
          hostUserId,
          requesterId,
          dto.appointmentDate,
          dto.startTime,
          dto.endTime,
          dto.note ?? null,
        ],
      );

      return this.getAppointment(client, inserted.rows[0].id);
    });
  }

  async listMyAppointments(userId: number) {
    return this.database.query(
      `SELECT ${APPOINTMENT_SELECT}
       FROM schedule_appointments a
       JOIN users host ON host.user_id = a.host_user_id
       JOIN users requester ON requester.user_id = a.requester_id
       WHERE a.host_user_id = $1 OR a.requester_id = $1
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [userId],
    );
  }

  async listAllAppointments(userRole: string) {
    if (userRole.toLowerCase() !== 'admin')
      throw new ForbiddenException('Admin access required');
    return this.database.query(
      `SELECT ${APPOINTMENT_SELECT}
       FROM schedule_appointments a
       JOIN users host ON host.user_id = a.host_user_id
       JOIN users requester ON requester.user_id = a.requester_id
       ORDER BY CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
                a.appointment_date DESC, a.start_time DESC`,
    );
  }

  async updateAppointmentStatus(
    userId: number,
    userRole: string,
    id: number,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.database.queryOne<{
      id: number;
      hostUserId: number;
      requesterId: number;
      status: string;
    }>(
      `SELECT appointment_id AS id, host_user_id AS "hostUserId",
              requester_id AS "requesterId", status
       FROM schedule_appointments WHERE appointment_id = $1`,
      [id],
    );
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isAdmin = userRole === 'admin';
    const isHost = appointment.hostUserId === userId;
    const isRequester = appointment.requesterId === userId;
    if (!isAdmin && !isHost && !isRequester) {
      throw new ForbiddenException('You are not part of this appointment');
    }
    if (!isAdmin && !isHost && dto.status !== 'cancelled') {
      throw new ForbiddenException(
        'Only the host can confirm or complete an appointment',
      );
    }
    if (['cancelled', 'completed'].includes(appointment.status)) {
      throw new BadRequestException(
        `Appointment is already ${appointment.status}`,
      );
    }

    const updated = await this.database.queryOne(
      `UPDATE schedule_appointments
       SET status = $2, note = COALESCE($3, note), updated_at = NOW()
       WHERE appointment_id = $1
       RETURNING appointment_id AS id, status`,
      [id, dto.status, dto.note ?? null],
    );
    return updated;
  }

  private async getAppointment(client: PoolClient, id: number) {
    const result = await client.query(
      `SELECT ${APPOINTMENT_SELECT}
       FROM schedule_appointments a
       JOIN users host ON host.user_id = a.host_user_id
       JOIN users requester ON requester.user_id = a.requester_id
       WHERE a.appointment_id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
