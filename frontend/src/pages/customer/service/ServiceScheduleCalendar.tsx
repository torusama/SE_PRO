import { CalendarDays } from "lucide-react";
import "./ServiceScheduleCalendar.css";

interface ServiceScheduleCalendarProps {
  requestedDate?: string | null;
  scheduledDate?: string | null;
  serviceName?: string;
  plotCode?: string | null;
}

function parseIsoDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function ServiceScheduleCalendar({
  requestedDate,
  scheduledDate,
  serviceName,
  plotCode,
}: ServiceScheduleCalendarProps) {
  const dateValue = scheduledDate || requestedDate;
  const selected = parseIsoDate(dateValue);

  if (!selected) {
    return (
      <section className="service-schedule-calendar is-empty">
        <CalendarDays size={18} />
        <div>
          <strong>Chưa có ngày thực hiện</strong>
          <span>
            Ngày dịch vụ sẽ được hiển thị tại đây sau khi được ghi nhận.
          </span>
        </div>
      </section>
    );
  }

  const year = selected.getFullYear();
  const month = selected.getMonth();
  const selectedDay = selected.getDate();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: offset + days }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );

  return (
    <section
      className="service-schedule-calendar"
      aria-label="Lịch thực hiện dịch vụ"
    >
      <header>
        <span>
          <CalendarDays size={17} />
        </span>
        <div>
          <small>
            {scheduledDate ? "Lịch đã được sắp xếp" : "Ngày bạn đã chọn"}
          </small>
          <strong>
            {selected.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </strong>
        </div>
      </header>

      <div className="service-schedule-calendar-month">
        <strong>
          Tháng {month + 1}/{year}
        </strong>
        <div className="service-schedule-calendar-weekdays">
          {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="service-schedule-calendar-days">
          {cells.map((day, index) =>
            day ? (
              <span
                key={day}
                className={day === selectedDay ? "is-selected" : ""}
                aria-current={day === selectedDay ? "date" : undefined}
              >
                {day}
              </span>
            ) : (
              <span key={`empty-${index}`} />
            ),
          )}
        </div>
      </div>

      {(serviceName || plotCode) && (
        <footer>
          {serviceName && <span>{serviceName}</span>}
          {plotCode && <strong>Lô {plotCode}</strong>}
        </footer>
      )}
    </section>
  );
}
