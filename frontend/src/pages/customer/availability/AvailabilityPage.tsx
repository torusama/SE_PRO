import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import "./AvailabilityPage.css";

interface AvailabilitySlot {
  id: number;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  isActive: boolean;
}

const DAYS = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string | string[] } } }
    ).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateToKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateDisplay(value: string) {
  const date = parseDateKey(value);
  if (!date) return "Chọn ngày";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return dateToKey(a) === dateToKey(b);
}

function CalendarPicker({
  value,
  minDate,
  onChange,
}: {
  value: string;
  minDate: Date;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    () => parseDateKey(value) ?? minDate,
  );
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDateKey(value);
  const today = startOfDay(new Date());
  const minDay = startOfDay(minDate);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 340), 360);
    const gap = 10;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const estimatedHeight = 370;
    const placeAbove =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight + gap;
    const top = placeAbove
      ? Math.max(12, rect.top - estimatedHeight - gap)
      : rect.bottom + gap;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    setPopoverStyle({ position: "fixed", top, left, width, zIndex: 100000 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const parsed = parseDateKey(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(viewDate);
  const cells = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() + 1,
      0,
    ).getDate();
    const total = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from(
      { length: total },
      (_, index) =>
        new Date(
          viewDate.getFullYear(),
          viewDate.getMonth(),
          index - firstWeekday + 1,
        ),
    );
  }, [viewDate]);

  function choose(date: Date) {
    if (startOfDay(date) < minDay) return;
    onChange(dateToKey(date));
    setOpen(false);
  }

  const popover = open
    ? createPortal(
        <div
          ref={popoverRef}
          className="availability-date-popover"
          style={popoverStyle}
          role="dialog"
          aria-label="Chọn ngày"
        >
          <div className="availability-calendar-head">
            <button
              type="button"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1),
                )
              }
              aria-label="Tháng trước"
            >
              <ChevronLeft size={17} />
            </button>
            <div className="availability-calendar-title">
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="availability-today-link"
                onClick={() =>
                  setViewDate(
                    new Date(today.getFullYear(), today.getMonth(), 1),
                  )
                }
              >
                Hôm nay
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
                )
              }
              aria-label="Tháng sau"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="availability-calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="availability-calendar-grid">
            {cells.map((date) => {
              const currentMonth = date.getMonth() === viewDate.getMonth();
              const disabled = startOfDay(date) < minDay;
              const selected = selectedDate
                ? isSameDay(date, selectedDate)
                : false;
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={dateToKey(date)}
                  type="button"
                  className={`availability-calendar-day${currentMonth ? "" : " muted"}${disabled ? " disabled" : ""}${selected ? " selected" : ""}${isToday ? " today" : ""}`}
                  disabled={disabled}
                  onClick={() => choose(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`availability-date-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="availability-date-trigger-icon">
          <CalendarDays size={18} />
        </span>
        <span className={value ? "selected" : "placeholder"}>
          {formatDateDisplay(value)}
        </span>
        <ChevronRight
          className={`availability-date-chevron${open ? " is-open" : ""}`}
          size={17}
        />
      </button>
      {popover}
    </>
  );
}

function TimeSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  const minutes = Array.from({ length: 12 }, (_, index) => index * 5);
  const [hour24, minute24] = value.split(":").map(Number);
  const validHour24 = Number.isFinite(hour24) ? hour24 : 9;
  const validMinute = Number.isFinite(minute24) ? minute24 : 0;
  const currentPeriod: "AM" | "PM" = validHour24 >= 12 ? "PM" : "AM";
  const currentHour12 = validHour24 % 12 || 12;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(390, Math.max(330, rect.width + 40));
    const gap = 10;
    const estimatedHeight = 330;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const placeAbove =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight + gap;
    const top = placeAbove
      ? Math.max(12, rect.top - estimatedHeight - gap)
      : rect.bottom + gap;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    setPopoverStyle({ position: "fixed", top, left, width, zIndex: 100001 });
  }, []);

  // Mỗi lựa chọn (giờ / phút / buổi) được áp dụng và lưu ngay lập tức vào `value`
  // thật (không còn state "nháp" riêng), giống hệt cách ô chọn ngày hoạt động.
  // Nhờ vậy sẽ không còn chuyện chọn ô này làm mất lựa chọn ở ô kia nữa.
  function applyHour(hour12: number) {
    let next24 = hour12 % 12;
    if (currentPeriod === "PM") next24 += 12;
    onChange(`${pad2(next24)}:${pad2(validMinute)}`);
  }

  function applyMinute(minute: number) {
    onChange(`${pad2(validHour24)}:${pad2(minute)}`);
  }

  function applyPeriod(period: "AM" | "PM") {
    let next24 = currentHour12 % 12;
    if (period === "PM") next24 += 12;
    onChange(`${pad2(next24)}:${pad2(validMinute)}`);
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const timePopover = open
    ? createPortal(
        <div
          ref={popoverRef}
          className="availability-time-popover availability-time-popover-floating"
          style={popoverStyle}
          role="dialog"
          aria-label={`Chọn ${label.toLowerCase()}`}
        >
          <div className="availability-time-popover-head">
            <div>
              <strong>{label}</strong>
              <span>
                {pad2(currentHour12)}:{pad2(validMinute)}{" "}
                {currentPeriod === "AM" ? "SA" : "CH"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
          <div className="availability-time-columns">
            <div className="availability-time-column">
              <span>GIỜ</span>
              <div className="availability-time-options">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    className={currentHour12 === hour ? "selected" : ""}
                    onClick={() => applyHour(hour)}
                  >
                    {pad2(hour)}
                  </button>
                ))}
              </div>
            </div>
            <div className="availability-time-column">
              <span>PHÚT</span>
              <div className="availability-time-options">
                {minutes.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={validMinute === mins ? "selected" : ""}
                    onClick={() => applyMinute(mins)}
                  >
                    {pad2(mins)}
                  </button>
                ))}
              </div>
            </div>
            <div className="availability-time-column availability-period-column">
              <span>BUỔI</span>
              <div className="availability-period-options">
                {(["AM", "PM"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={currentPeriod === period ? "selected" : ""}
                    onClick={() => applyPeriod(period)}
                  >
                    {period === "AM" ? "SA" : "CH"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="availability-time-popover-footer">
            <button
              type="button"
              className="confirm"
              onClick={() => setOpen(false)}
            >
              Xong
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`availability-time-field${open ? " is-open" : ""}`}>
      <span className="availability-control-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="availability-time-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="availability-time-icon">
          <Clock3 size={17} />
        </span>
        <span className="availability-time-value">
          {pad2(currentHour12)}:{pad2(validMinute)}{" "}
          {currentPeriod === "AM" ? "SA" : "CH"}
        </span>
        <ChevronRight
          className={`availability-time-chevron${open ? " is-open" : ""}`}
          size={16}
        />
      </button>
      {timePopover}
    </div>
  );
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [specificDate, setSpecificDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const minDate = useMemo(() => startOfDay(new Date()), []);

  const loadSlots = useCallback(async () => {
    try {
      const response = await api.get("/schedule/slots/me");
      setSlots(response.data.data ?? []);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);
  useRealtimeRefresh(["appointments"], loadSlots);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isRecurring && !specificDate)
      return setMessage("Vui lòng chọn ngày rảnh.");
    if (endTime <= startTime)
      return setMessage("Giờ kết thúc phải sau giờ bắt đầu.");
    setSaving(true);
    setMessage("");
    try {
      await api.post("/schedule/slots", {
        isRecurring,
        ...(isRecurring ? { dayOfWeek } : { specificDate }),
        startTime,
        endTime,
      });
      setMessage("Đã thêm lịch rảnh để sử dụng khi đặt lịch gặp.");
      await loadSlots();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(slot: AvailabilitySlot) {
    try {
      await api.patch(`/schedule/slots/${slot.id}`, {
        isActive: !slot.isActive,
      });
      await loadSlots();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Bạn có chắc muốn xóa khung giờ này?")) return;
    try {
      await api.delete(`/schedule/slots/${id}`);
      await loadSlots();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <main className="availability-page">
      <section className="availability-hero">
        <p className="availability-kicker">HẸN GẶP TRỰC TIẾP</p>
        <h1>Lịch rảnh của tôi</h1>
        <p>
          Thêm các khung giờ bạn rảnh để dùng khi gửi yêu cầu hẹn gặp và trao
          đổi trực tiếp.
        </p>
      </section>
      <div className="availability-grid">
        <form
          className="availability-card availability-form-card"
          onSubmit={submit}
        >
          <h2>Thêm khung giờ rảnh</h2>
          <div className="availability-mode">
            <button
              type="button"
              className={!isRecurring ? "active" : ""}
              onClick={() => setIsRecurring(false)}
            >
              Ngày cụ thể
            </button>
            <button
              type="button"
              className={isRecurring ? "active" : ""}
              onClick={() => setIsRecurring(true)}
            >
              Lặp hằng tuần
            </button>
          </div>

          {isRecurring ? (
            <label>
              Thứ trong tuần
              <select
                className="availability-native-select"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="availability-field availability-date-field">
              <span className="availability-control-label">Ngày</span>
              <CalendarPicker
                value={specificDate}
                minDate={minDate}
                onChange={setSpecificDate}
              />
            </div>
          )}

          <div className="availability-times">
            <TimeSelector
              label="Bắt đầu"
              value={startTime}
              onChange={setStartTime}
            />
            <TimeSelector
              label="Kết thúc"
              value={endTime}
              onChange={setEndTime}
            />
          </div>

          <button className="availability-submit" disabled={saving}>
            {saving ? "Đang lưu..." : "+ Thêm lịch rảnh"}
          </button>
          {message && <p className="availability-message">{message}</p>}
        </form>
        <section className="availability-card availability-list-card">
          <h2>Các khung giờ đã tạo</h2>
          {loading ? (
            <p>Đang tải...</p>
          ) : slots.length === 0 ? (
            <p className="availability-empty">Bạn chưa có lịch rảnh nào.</p>
          ) : (
            <div className="availability-list">
              {slots.map((slot) => (
                <article
                  className={`availability-slot ${slot.isActive ? "" : "disabled"}`}
                  key={slot.id}
                >
                  <div>
                    <strong>
                      {slot.isRecurring
                        ? `${DAYS[slot.dayOfWeek ?? 0]} hằng tuần`
                        : formatDateDisplay(slot.specificDate ?? "")}
                    </strong>
                    <span>
                      {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                    </span>
                  </div>
                  <div className="availability-actions">
                    <button type="button" onClick={() => void toggle(slot)}>
                      {slot.isActive ? "Tạm ẩn" : "Bật lại"}
                    </button>
                    <button
                      type="button"
                      className="delete"
                      onClick={() => void remove(slot.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
