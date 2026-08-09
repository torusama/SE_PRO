import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { AdminReminderQueryDto } from './dto/admin-reminder-query.dto';
import { paginate } from '../../common/interfaces/paginated-response.interface';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RealtimeService } from '../realtime/realtime.service';

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
  calendarType: string | null;
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
       r.calendar_type AS "calendarType",
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
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async create(userId: number, dto: CreateReminderDto) {
    const isRecurring = dto.isRecurring ?? true;
    const calendarType = dto.calendarType ?? 'solar';
    const { remindMonth, remindDay, specificDate } = this.resolveDate(
      isRecurring,
      dto.remindMonth,
      dto.remindDay,
      dto.specificDate,
    );
    if (dto.deceasedProfileId !== undefined) {
      const allowed = await this.database.queryOne(
        `SELECT 1 FROM deceased_profiles dp
         WHERE dp.deceased_profile_id=$1 AND dp.is_deleted=FALSE
           AND (EXISTS(SELECT 1 FROM ownership_records o WHERE o.plot_id=dp.plot_id AND o.user_id=$2 AND o.is_current=TRUE)
             OR EXISTS(SELECT 1 FROM resource_permissions rp JOIN family_memberships fm ON fm.membership_id=rp.membership_id AND fm.is_active=TRUE
               JOIN family_groups fg ON fg.family_id=fm.family_id AND fg.status='active' AND fg.is_deleted=FALSE
               WHERE fm.user_id=$2 AND rp.resource_type='deceased_profile' AND rp.resource_id=dp.deceased_profile_id
                 AND rp.action='view_profile' AND rp.revoked_at IS NULL))`,
        [dto.deceasedProfileId, userId],
      );
      if (!allowed) throw new NotFoundException('Không tìm thấy hồ sơ');
    }
    const row = await this.database.queryOne<ReminderRow>(
      `INSERT INTO reminders AS r
         (user_id, plot_id, ownership_id, title, description,
          remind_month, remind_day, lunar_month, lunar_day, is_leap_month,
          specific_date, reminder_type, is_recurring, calendar_type, notify_days_before,
          notify_email, notify_emails, deceased_profile_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING ${SELECT_FIELDS}`,
      [
        userId,
        dto.plotId ?? null,
        dto.ownershipId ?? null,
        dto.title.trim(),
        dto.description?.trim() || null,
        remindMonth,
        remindDay,
        dto.lunarMonth ?? (calendarType === 'lunar' ? remindMonth : null),
        dto.lunarDay ?? (calendarType === 'lunar' ? remindDay : null),
        dto.isLeapMonth ?? false,
        specificDate,
        dto.reminderType ?? 'death_anniversary',
        isRecurring,
        calendarType,
        dto.notifyDaysBefore ?? 3,
        dto.notifyEmail ?? (dto.notifyEmails?.length ? true : false),
        dto.notifyEmails ?? [],
        dto.deceasedProfileId ?? null,
      ],
    );

    await this.database.query(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,new_value)
       VALUES($1,'reminder.create','reminder',$2,$3::jsonb)`,
      [
        userId,
        row!.id,
        JSON.stringify({ deceasedProfileId: dto.deceasedProfileId ?? null }),
      ],
    );

    await this.notifyAdmins(row!);

    return this.decorate(row!);
  }

  /** Báo cho toàn bộ admin đang hoạt động biết khách hàng vừa tạo nhắc lịch mới. */
  private async notifyAdmins(row: ReminderRow) {
    const title = 'Khách hàng vừa tạo nhắc lịch mới';
    const message = `${row.title}${
      row.remindMonth && row.remindDay
        ? ` — ngày ${row.remindDay}/${row.remindMonth}`
        : ''
    }.`;
    await this.database.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       SELECT user_id, 'reminder_created', $1, $2, 'reminder', $3
       FROM users
       WHERE LOWER(role) = 'admin' AND is_active = TRUE AND is_deleted = FALSE`,
      [title, message, row.id],
    );
  }

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
    return rows
      .map((row) => this.decorate(row))
      .sort((a, b) => {
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

  // ── ADMIN: lấy toàn bộ nhắc lịch kèm thông tin khách hàng ──────────────
  async allForAdmin(
    filters: AdminReminderQueryDto = new AdminReminderQueryDto(),
  ) {
    const conditions: string[] = ['r.is_deleted = FALSE'];
    const params: any[] = [];

    if (filters.type && filters.type !== 'all') {
      params.push(filters.type);
      conditions.push(`r.reminder_type = $${params.length}`);
    }
    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      const idx = params.length;
      conditions.push(
        `(LOWER(r.title) LIKE $${idx} OR LOWER(u.full_name) LIKE $${idx} OR LOWER(p.plot_code) LIKE $${idx})`,
      );
    }

    const where = conditions.join(' AND ');

    const count = await this.database.queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM reminders r
       JOIN users u ON u.user_id=r.user_id
       LEFT JOIN plots p ON p.plot_id=r.plot_id
       WHERE ${where}`,
      params,
    );
    params.push(filters.pageSize, filters.offset);
    const rows = await this.database.query<
      ReminderRow & {
        customerName: string;
        customerPhone: string | null;
        plotCode: string | null;
        zoneName: string | null;
        lastNotifiedAt: string | null;
      }
    >(
      `SELECT ${SELECT_FIELDS},
              u.full_name      AS "customerName",
              u.phone_number   AS "customerPhone",
              p.plot_code      AS "plotCode",
              z.zone_name      AS "zoneName",
              r.last_sent_at   AS "lastNotifiedAt"
       FROM reminders r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN plots p ON p.plot_id = r.plot_id
       LEFT JOIN cemetery_zones z ON z.zone_id = p.zone_id
       WHERE ${where}
       ORDER BY r.is_active DESC, r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const items = rows
      .map((row) => {
        const decorated = this.decorate(row);
        return {
          ...decorated,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          plotCode: row.plotCode,
          zoneName: row.zoneName,
          lastNotifiedAt: row.lastNotifiedAt,
        };
      })
      .sort((a, b) => {
        if (a.daysUntil === null) return 1;
        if (b.daysUntil === null) return -1;
        return a.daysUntil - b.daysUntil;
      });
    return paginate(
      items,
      Number(count?.total ?? 0),
      filters.page,
      filters.pageSize,
    );
  }

  // ── ADMIN: gửi nhắc thủ công ngay ────────────────────────────────────────
  async notifyNow(id: number) {
    const row = await this.database.queryOne<
      ReminderRow & {
        customerName: string;
        userId: number;
        notifyEmails: string[];
      }
    >(
      `SELECT ${SELECT_FIELDS}, u.full_name AS "customerName", p.plot_code AS "plotCode"
       FROM reminders r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN plots p ON p.plot_id = r.plot_id
       WHERE r.reminder_id = $1 AND r.is_deleted = FALSE`,
      [id],
    );

    if (!row) throw new NotFoundException('Không tìm thấy nhắc lịch.');

    const decorated = this.decorate(row);
    const location = row.plotCode ? ` tại lô ${row.plotCode}` : '';
    const message = `${row.title}${location}${decorated.nextDate ? ` — ngày ${decorated.nextDate}` : ''}.`;

    await this.notificationsService.createInApp(
      row.userId,
      'memorial_reminder',
      `Nhắc lịch: ${row.title}`,
      message,
      'reminder',
      row.id,
    );

    if (row.notifyEmail && row.notifyEmails?.length) {
      for (const email of row.notifyEmails) {
        try {
          await this.emailService.sendReminderEmail(
            email,
            `Nhắc lịch: ${row.title}`,
            message,
          );
        } catch (err) {
          this.logger.error(
            `Gửi email thủ công tới ${email} thất bại: ${(err as Error).message}`,
          );
        }
      }
    }

    await this.database.query(
      `UPDATE reminders SET last_sent_at = NOW() WHERE reminder_id = $1`,
      [id],
    );

    return { id, notified: true };
  }

  async update(userId: number, id: number, dto: UpdateReminderDto) {
    const existing = await this.getOwned(userId, id);
    const isRecurring = dto.isRecurring ?? existing.isRecurring;
    const { remindMonth, remindDay, specificDate } = this.resolveDate(
      isRecurring,
      dto.remindMonth ??
        (isRecurring ? (existing.remindMonth ?? undefined) : undefined),
      dto.remindDay ??
        (isRecurring ? (existing.remindDay ?? undefined) : undefined),
      dto.specificDate ?? existing.specificDate ?? undefined,
    );
    const calendarType = dto.calendarType ?? existing.calendarType ?? 'solar';
    const row = await this.database.queryOne<ReminderRow>(
      `UPDATE reminders AS r SET
         title = $3, description = $4, plot_id = $5, ownership_id = $6,
         reminder_type = $7, is_recurring = $8, calendar_type = $9,
         remind_month = $10, remind_day = $11,
         lunar_month = $12, lunar_day = $13, is_leap_month = $14,
         specific_date = $15, notify_days_before = $16,
         is_active = $17, notify_email = $18, notify_emails = $19,
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
        calendarType,
        remindMonth,
        remindDay,
        dto.lunarMonth ?? (calendarType === 'lunar' ? remindMonth : existing.lunarMonth),
        dto.lunarDay ?? (calendarType === 'lunar' ? remindDay : existing.lunarDay),
        dto.isLeapMonth ?? existing.isLeapMonth,
        specificDate,
        dto.notifyDaysBefore ?? existing.notifyDaysBefore,
        dto.isActive ?? existing.isActive,
        dto.notifyEmail ??
          (dto.notifyEmails
            ? dto.notifyEmails.length > 0
            : existing.notifyEmail),
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

  private decorate(row: ReminderRow) {
    const today = this.startOfDay(new Date());
    let nextDate: Date | null = null;

    if (row.isRecurring && row.remindMonth && row.remindDay) {
      nextDate = this.nextRecurringDate(today, row.remindMonth, row.remindDay);
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
      this.realtime?.publish(
        ['reminders'],
        [`user:${row.userId}`, 'admin'],
      );
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Đã gửi ${sent} thông báo nhắc lịch.`);
    }
  }
}
