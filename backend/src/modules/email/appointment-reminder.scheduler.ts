import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { AppointmentEmailDraftService } from './appointment-email-draft.service';
import { EmailService } from './email.service';

interface AppointmentReminderCandidate {
  source: 'schedule' | 'offline';
  id: number;
  customerId: number;
  customerName: string | null;
  email: string;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  topic: string | null;
}

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

@Injectable()
export class AppointmentReminderScheduler {
  private readonly logger = new Logger(AppointmentReminderScheduler.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly emailService: EmailService,
    private readonly drafts: AppointmentEmailDraftService,
  ) {}

  @Cron('0 0 7 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async sendTomorrowAppointmentReminders() {
    const candidates = await this.loadTomorrowAppointments();
    let sent = 0;

    for (const appointment of candidates) {
      if (await this.wasDelivered(appointment)) continue;

      const timeLabel = appointment.endTime
        ? `${appointment.startTime}–${appointment.endTime}`
        : appointment.startTime;
      const locationText = appointment.location?.trim()
        ? ` tại ${appointment.location.trim()}`
        : '';
      const appointmentDateLabel = displayDate(appointment.appointmentDate);
      const fallback = [
        `Lịch hẹn của Quý khách với ban quản lý Vĩnh Phúc Viên sẽ diễn ra vào ngày mai, ${appointmentDateLabel}, lúc ${timeLabel}${locationText}.`,
        appointment.topic?.trim()
          ? `Nội dung trao đổi đã ghi nhận: ${appointment.topic.trim()}.`
          : 'Đây là buổi hẹn đã được hai bên xác nhận trên hệ thống.',
        'Quý khách vui lòng kiểm tra lại thời gian, địa điểm và chuẩn bị những thông tin cần trao đổi để buổi gặp diễn ra thuận tiện. Nếu có thay đổi, vui lòng cập nhật sớm trong mục Lịch hẹn hoặc liên hệ ban quản lý.',
      ].join(' ');

      const draft = await this.drafts.generate({
        customerName: appointment.customerName,
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        location: appointment.location,
        topic: appointment.topic,
        fallback,
      });

      try {
        const delivered = await this.emailService.sendAppointmentReminderEmail(
          appointment.email,
          {
            customerName: appointment.customerName,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            location: appointment.location,
            topic: appointment.topic,
            message: draft.content,
          },
        );
        if (!delivered) {
          this.logger.warn(
            `Chưa ghi nhận nhắc lịch ${appointment.source} #${appointment.id} vì Gmail chưa gửi được.`,
          );
          continue;
        }

        await this.database.transaction(async (client) => {
          await client.query(
            `INSERT INTO appointment_reminder_deliveries
               (appointment_source, appointment_id, user_id, appointment_date, email, ai_generated)
             VALUES ($1, $2, $3, $4::date, $5, $6)
             ON CONFLICT (appointment_source, appointment_id, appointment_date, email)
             DO NOTHING`,
            [
              appointment.source,
              appointment.id,
              appointment.customerId,
              appointment.appointmentDate,
              appointment.email,
              draft.aiUsed,
            ],
          );
          await client.query(
            `INSERT INTO notifications
               (user_id, type, title, message, related_entity_type, related_entity_id)
             VALUES ($1, 'appointment_reminder', 'Nhắc lịch hẹn ngày mai', $2, $3, $4)`,
            [
              appointment.customerId,
              `Lịch hẹn với ban quản lý vào ${timeLabel}, ngày ${appointmentDateLabel}.`,
              appointment.source === 'schedule'
                ? 'schedule_appointment'
                : 'offline_appointment',
              appointment.id,
            ],
          );
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Gửi email nhắc lịch ${appointment.source} #${appointment.id} tới ${appointment.email} thất bại: ${(error as Error).message}`,
        );
      }
    }

    if (sent > 0) {
      this.logger.log(`Đã gửi ${sent} email nhắc lịch hẹn trước 1 ngày.`);
    }
  }

  private async wasDelivered(candidate: AppointmentReminderCandidate) {
    const row = await this.database.queryOne(
      `SELECT delivery_id
       FROM appointment_reminder_deliveries
       WHERE appointment_source = $1
         AND appointment_id = $2
         AND appointment_date = $3::date
         AND LOWER(email) = LOWER($4)
       LIMIT 1`,
      [candidate.source, candidate.id, candidate.appointmentDate, candidate.email],
    );
    return Boolean(row);
  }

  private async loadTomorrowAppointments(): Promise<AppointmentReminderCandidate[]> {
    const direct = await this.database.query<AppointmentReminderCandidate>(
      `SELECT 'schedule'::text AS source,
              a.appointment_id AS id,
              a.requester_id AS "customerId",
              requester.full_name AS "customerName",
              requester.email,
              TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS "appointmentDate",
              TO_CHAR(a.start_time, 'HH24:MI') AS "startTime",
              TO_CHAR(a.end_time, 'HH24:MI') AS "endTime",
              NULL::text AS location,
              a.note AS topic
       FROM schedule_appointments a
       JOIN users requester ON requester.user_id = a.requester_id
       WHERE a.status = 'confirmed'
         AND requester.is_active = TRUE
         AND requester.is_deleted = FALSE
         AND requester.email IS NOT NULL
         AND BTRIM(requester.email) <> ''
         AND a.appointment_date =
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1`,
    );

    const offline = await this.database.query<AppointmentReminderCandidate>(
      `SELECT 'offline'::text AS source,
              oa.appointment_id AS id,
              oa.user_id AS "customerId",
              customer.full_name AS "customerName",
              customer.email,
              TO_CHAR(
                COALESCE(oa.customer_selected_at, oa.scheduled_at)
                  AT TIME ZONE 'Asia/Ho_Chi_Minh',
                'YYYY-MM-DD'
              ) AS "appointmentDate",
              TO_CHAR(
                COALESCE(oa.customer_selected_at, oa.scheduled_at)
                  AT TIME ZONE 'Asia/Ho_Chi_Minh',
                'HH24:MI'
              ) AS "startTime",
              TO_CHAR(
                oa.scheduled_end_at AT TIME ZONE 'Asia/Ho_Chi_Minh',
                'HH24:MI'
              ) AS "endTime",
              oa.location,
              oa.note AS topic
       FROM offline_appointments oa
       JOIN users customer ON customer.user_id = oa.user_id
       WHERE oa.status = 'scheduled'
         AND oa.customer_status = 'confirmed'
         AND oa.is_deleted = FALSE
         AND customer.is_active = TRUE
         AND customer.is_deleted = FALSE
         AND customer.email IS NOT NULL
         AND BTRIM(customer.email) <> ''
         AND (
           COALESCE(oa.customer_selected_at, oa.scheduled_at)
             AT TIME ZONE 'Asia/Ho_Chi_Minh'
         )::date =
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1`,
    );

    return [...direct, ...offline];
  }
}
