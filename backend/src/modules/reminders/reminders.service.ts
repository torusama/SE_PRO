import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

interface ReminderRow {
  id: number;
  userId: number;
  plotId: number | null;
  ownershipId: number | null;
  title: string;
  description: string | null;
  remindMonth: number | null;
  remindDay: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  specificDate: string | null;
  reminderType: string;
  isRecurring: boolean;
  notifyDaysBefore: number;
  notifyEmail: boolean;
  notifyEmails: string[];
  isActive: boolean;
  lastSentAt: string | null;
  lastSentYear: number | null;
  createdAt: string;
  plotCode?: string | null;
  deceasedName?: string | null;
}

const SELECT_FIELDS = `r.reminder_id AS id, r.user_id AS "userId", r.plot_id AS "plotId",
       r.ownership_id AS "ownershipId", r.title, r.description,
       r.remind_month AS "remindMonth", r.remind_day AS "remindDay",
       r.lunar_month AS "lunarMonth", r.lunar_day AS "lunarDay",
       r.is_leap_month AS "isLeapMonth", r.specific_date AS "specificDate",
       r.reminder_type AS "reminderType", r.is_recurring AS "isRecurring",
       r.notify_days_before AS "notifyDaysBefore",
       r.notify_email AS "notifyEmail", r.notify_emails AS "notifyEmails",
       r.is_active AS "isActive",
       r.last_sent_at AS "lastSentAt", r.last_sent_year AS "lastSentYear",
       r.created_at AS "createdAt"`;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async create(userId: number, dto: CreateReminderDto) {
    const isRecurring = dto.isRecurring ?? true;
    const { remindMonth, remindDay, specificDate } = this.resolveDate(
      isRecurring,
      dto.remindMonth,
      dto.remindDay,
      dto.specificDate,
    );
    const row = await this.database.queryOne<ReminderRow>(
      `INSERT INTO reminders AS r
         (user_id, plot_id, ownership_id, title, description,
          remind_month, remind_day, lunar_month, lunar_day, is_leap_month,
          specific_date, reminder_type, is_recurring, notify_days_before,
          notify_email, notify_emails)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING ${SELECT_FIELDS}`,
      [
        userId,
        dto.plotId ?? null,
        dto.ownershipId ?? null,
        dto.title.trim(),
        dto.description?.trim() || null,
        remindMonth,
        remindDay,
        dto.lunarMonth ?? null,
        dto.lunarDay ?? null,
        dto.isLeapMonth ?? false,
        specificDate,
        dto.reminderType ?? 'death_anniversary',
        isRecurring,
        dto.notifyDaysBefore ?? 3,
        dto.notifyEmail ?? (dto.notifyEmails?.length ? true : false),
        dto.notifyEmails ?? [],
      ],
    );
    return this.decorate(row!);
  }

  /**
   * remind_month/remind_day trong DB luôn NOT NULL (dùng cho index quét theo
   * ngày/tháng), kể cả với nhắc 1 lần (is_recurring = false) — trường hợp đó
   * suy ra trực tiếp từ specific_date thay vì bắt người dùng nhập lại.
   */
  private resolveDate(
    isRecurring: boolean,
    remindMonth?: number,
    remindDay?: number,
    specificDate?: string,
  ) {
    if (!isRecurring) {
      if (!specificDate) {
        throw new BadRequestException(
          'Vui lòng chọn ngày cụ thể cho nhắc lịch 1 lần.',
        );
      }
      const parsed = new Date(specificDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Ngày cụ thể không hợp lệ.');
      }
      return {
        remindMonth: parsed.getMonth() + 1,
        remindDay: parsed.getDate(),
        specificDate,
      };
    }
    if (!remindMonth || !remindDay) {
      throw new BadRequestException(
        'Vui lòng chọn tháng và ngày nhắc lịch hàng năm.',
      );
    }
    return { remindMonth, remindDay, specificDate: null };
  }

  async my(userId: number) {
    const rows = await this.database.query<ReminderRow>(
      `SELECT ${SELECT_FIELDS}, p.plot_code AS "plotCode", o.deceased_name AS "deceasedName"
       FROM reminders r
       LEFT JOIN plots p ON p.plot_id = r.plot_id
       LEFT JOIN ownership_records o ON o.ownership_id = r.ownership_id
       WHERE r.user_id = $1 AND r.is_deleted = FALSE
       ORDER BY r.is_active DESC, r.created_at DESC`,
      [userId],
    );
    return rows.map((row) => this.decorate(row)).sort((a, b) => {
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    });
  }

  async upcoming(userId: number) {
    const reminders = await this.my(userId);
    const active = reminders.filter(
      (reminder) => reminder.isActive && reminder.daysUntil !== null,
    );
    return active[0] ?? null;
  }

  async update(userId: number, id: number, dto: UpdateReminderDto) {
    const existing = await this.getOwned(userId, id);
    const isRecurring = dto.isRecurring ?? existing.isRecurring;
    const { remindMonth, remindDay, specificDate } = this.resolveDate(
      isRecurring,
      dto.remindMonth ?? (isRecurring ? existing.remindMonth ?? undefined : undefined),
      dto.remindDay ?? (isRecurring ? existing.remindDay ?? undefined : undefined),
      dto.specificDate ?? existing.specificDate ?? undefined,
    );
    const row = await this.database.queryOne<ReminderRow>(
      `UPDATE reminders AS r SET
         title = $3, description = $4, plot_id = $5, ownership_id = $6,
         reminder_type = $7, is_recurring = $8,
         remind_month = $9, remind_day = $10,
         lunar_month = $11, lunar_day = $12, is_leap_month = $13,
         specific_date = $14, notify_days_before = $15,
         is_active = $16, notify_email = $17, notify_emails = $18,
         updated_at = NOW()
       WHERE r.reminder_id = $1 AND r.user_id = $2 AND r.is_deleted = FALSE
       RETURNING ${SELECT_FIELDS}`,
      [
        id,
        userId,
        dto.title?.trim() ?? existing.title,
        dto.description !== undefined
          ? dto.description?.trim() || null
          : existing.description,
        dto.plotId ?? existing.plotId,
        dto.ownershipId ?? existing.ownershipId,
        dto.reminderType ?? existing.reminderType,
        isRecurring,
        remindMonth,
        remindDay,
        dto.lunarMonth ?? existing.lunarMonth,
        dto.lunarDay ?? existing.lunarDay,
        dto.isLeapMonth ?? existing.isLeapMonth,
        specificDate,
        dto.notifyDaysBefore ?? existing.notifyDaysBefore,
        dto.isActive ?? existing.isActive,
        dto.notifyEmail ?? (dto.notifyEmails ? dto.notifyEmails.length > 0 : existing.notifyEmail),
        dto.notifyEmails ?? existing.notifyEmails,
      ],
    );
    if (!row) throw new NotFoundException('Reminder not found');
    return this.decorate(row);
  }

  async remove(userId: number, id: number) {
    await this.getOwned(userId, id);
    await this.database.query(
      `UPDATE reminders SET is_deleted = TRUE, updated_at = NOW()
       WHERE reminder_id = $1 AND user_id = $2`,
      [id, userId],
    );
    return { id, deleted: true };
  }

  private async getOwned(userId: number, id: number) {
    const row = await this.database.queryOne<ReminderRow>(
      `SELECT ${SELECT_FIELDS} FROM reminders r
       WHERE r.reminder_id = $1 AND r.user_id = $2 AND r.is_deleted = FALSE`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Reminder not found');
    return row;
  }

  /** Tính ngày dương lịch sắp tới (năm nay hoặc năm sau) và số ngày còn lại. */
  private decorate(row: ReminderRow) {
    const today = this.startOfDay(new Date());
    let nextDate: Date | null = null;

    if (row.isRecurring && row.remindMonth && row.remindDay) {
      nextDate = this.nextRecurringDate(
        today,
        row.remindMonth,
        row.remindDay,
      );
    } else if (!row.isRecurring && row.specificDate) {
      const specific = this.startOfDay(new Date(row.specificDate));
      nextDate = specific >= today ? specific : null;
    }

    const daysUntil = nextDate
      ? Math.round(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      ...row,
      nextDate: nextDate ? nextDate.toISOString().slice(0, 10) : null,
      daysUntil,
    };
  }

  private nextRecurringDate(today: Date, month: number, day: number): Date {
    const year = today.getFullYear();
    // Ngày 29/02 trên năm không nhuận -> lùi về 28/02 để tránh lỗi Date tràn tháng.
    const clampDay = (y: number, m: number, d: number) => {
      const daysInMonth = new Date(y, m, 0).getDate();
      return Math.min(d, daysInMonth);
    };
    let candidate = this.startOfDay(
      new Date(year, month - 1, clampDay(year, month, day)),
    );
    if (candidate < today) {
      candidate = this.startOfDay(
        new Date(year + 1, month - 1, clampDay(year + 1, month, day)),
      );
    }
    return candidate;
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Cron chạy mỗi ngày lúc 07:00 (giờ server) — quét toàn bộ nhắc lịch đang
   * hoạt động, và tạo thông báo trong app khi đến đúng số ngày cần báo trước
   * (notify_days_before). Mỗi mốc chỉ được gửi 1 lần / năm (recurring) hoặc
   * 1 lần duy nhất (nhắc 1 lần - specific_date).
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyReminderCheck() {
    const currentYear = new Date().getFullYear();
    const rows = await this.database.query<ReminderRow>(
      `SELECT ${SELECT_FIELDS}, p.plot_code AS "plotCode"
       FROM reminders r
       LEFT JOIN plots p ON p.plot_id = r.plot_id
       WHERE r.is_active = TRUE AND r.is_deleted = FALSE`,
    );

    let sent = 0;
    for (const row of rows) {
      const decorated = this.decorate(row);
      if (decorated.daysUntil === null) continue;
      if (decorated.daysUntil !== row.notifyDaysBefore) continue;

      if (row.isRecurring && row.lastSentYear === currentYear) continue;
      if (!row.isRecurring && row.lastSentAt) continue;

      const when =
        decorated.daysUntil === 0
          ? 'hôm nay'
          : `còn ${decorated.daysUntil} ngày nữa`;
      const location = row.plotCode ? ` tại lô ${row.plotCode}` : '';
      const message = `${row.title}${location} — ${when} (${decorated.nextDate}).`;

      await this.notificationsService.createInApp(
        row.userId,
        'memorial_reminder',
        `Sắp đến: ${row.title}`,
        message,
        'reminder',
        row.id,
      );

      if (row.notifyEmail && row.notifyEmails && row.notifyEmails.length > 0) {
        for (const email of row.notifyEmails) {
          try {
            await this.emailService.sendReminderEmail(
              email,
              `Sắp đến: ${row.title}`,
              message,
            );
          } catch (err) {
            this.logger.error(
              `Gửi email nhắc lịch tới ${email} thất bại: ${(err as Error).message}`,
            );
          }
        }
      }

      await this.database.query(
        `UPDATE reminders SET last_sent_at = NOW(), last_sent_year = $2
         WHERE reminder_id = $1`,
        [row.id, currentYear],
      );
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Đã gửi ${sent} thông báo nhắc lịch.`);
    }
  }
}