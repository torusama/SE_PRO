// Customer reminder page. The existing reminder APIs and business logic are kept intact;
// this file only refines the presentation, interaction feedback, and accessibility.
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";
import { nextLunarOccurrence } from "@/lib/lunarCalendar";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";
import "./RemindersPage.css";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

type ReminderType = "death_anniversary" | "memorial" | "maintenance" | "other";

type CalendarType = "solar" | "lunar";

interface Reminder {
  id: number;
  title: string;
  description?: string | null;
  plotId?: number | null;
  reminderType: ReminderType;
  isRecurring: boolean;
  calendarType?: CalendarType;
  remindMonth?: number | null;
  remindDay?: number | null;
  specificDate?: string | null;
  notifyDaysBefore: number;
  notifyEmail?: boolean;
  notifyEmails?: string[];
  isActive: boolean;
  plotCode?: string | null;
  deceasedName?: string | null;
  nextDate: string | null;
  daysUntil: number | null;
}

interface Contract {
  id: number;
  status: string;
  plotId: number;
  plotCode: string;
  zoneName?: string;
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>;
}

type IconName =
  | "bell"
  | "calendar"
  | "flame"
  | "heart"
  | "maintenance"
  | "circleBell"
  | "repeat"
  | "sun"
  | "moon"
  | "mail"
  | "plus"
  | "edit"
  | "trash"
  | "pause"
  | "play"
  | "chevronLeft"
  | "chevronRight"
  | "arrowRight"
  | "service"
  | "mapPin"
  | "clock"
  | "check"
  | "alert"
  | "x";

function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4M16 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="3" />
      </>
    ),
    flame: (
      <path d="M12 22c4.4 0 7-3 7-7 0-3-1.5-5.5-4.5-8.5.2 2-1 3.5-2.2 4.3C12 7.7 9.8 4.8 7 3c.3 4.5-2 6.2-2 10 0 5 3 9 7 9Z" />
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    maintenance: (
      <>
        <path d="M14.7 6.3a4 4 0 0 0-5-5L7.5 3.5l3 3 2.2-2.2a4 4 0 0 1-5 5L2 15l4 4 5.7-5.7a4 4 0 0 0 5-5Z" />
        <path d="m14 14 6 6" />
      </>
    ),
    circleBell: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 11a3 3 0 0 0-6 0c0 3-1.5 3.5-1.5 4.5h9C16.5 14.5 15 14 15 11M11 18h2" />
      </>
    ),
    repeat: (
      <>
        <path d="m17 1 4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="m7 23-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
    service: (
      <>
        <path d="M12 3v18M3 12h18" />
        <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />
      </>
    ),
    mapPin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M10.3 2.7 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.7a2 2 0 0 0-3.4 0Z" />
        <path d="M12 8v4M12 16h.01" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const TYPE_META: Record<
  ReminderType,
  { icon: IconName; label: string; dot: string }
> = {
  death_anniversary: { icon: "flame", label: "Ngày giỗ", dot: "gold" },
  memorial: { icon: "heart", label: "Tưởng niệm", dot: "purple" },
  maintenance: { icon: "maintenance", label: "Chăm sóc mộ", dot: "teal" },
  other: { icon: "circleBell", label: "Khác", dot: "dim" },
};

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không thực hiện được yêu cầu. Vui lòng thử lại.";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

const emptyForm = {
  title: "",
  description: "",
  plotId: null as number | null,
  reminderType: "death_anniversary" as ReminderType,
  isRecurring: true,
  calendarType: "solar" as CalendarType,
  remindMonth: "" as string | number,
  remindDay: "" as string | number,
  specificDate: "",
  notifyDaysBefore: 3,
  notifyEmails: [] as string[],
  notifyEmailDraft: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Với nhắc lịch lặp lại theo Âm lịch, backend chỉ lưu ngày/tháng âm — client
 * tự quy đổi ra ngày dương gần nhất để hiển thị đếm ngược, phòng khi backend
 * chưa hỗ trợ tính nextDate theo âm lịch. */
function effectiveNextDate(r: Reminder): {
  date: Date | null;
  iso: string | null;
} {
  if (
    r.isRecurring &&
    r.calendarType === "lunar" &&
    r.remindDay &&
    r.remindMonth
  ) {
    const date = nextLunarOccurrence(r.remindDay, r.remindMonth);
    return { date, iso: date.toISOString().slice(0, 10) };
  }
  if (!r.nextDate) return { date: null, iso: null };
  return { date: new Date(r.nextDate), iso: r.nextDate.slice(0, 10) };
}

function daysBetween(a: Date, b: Date): number {
  const ms =
    new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round(ms / 86400000);
}

export default function RemindersPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = Boolean(token);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ownedPlots, setOwnedPlots] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      if (!isAuthenticated) {
        setReminders([]);
        setOwnedPlots([]);
        return;
      }
      const [reminderRes, contractRes] = await Promise.all([
        api.get<ApiResponse<Reminder[]>>("/my/reminders"),
        api.get<ApiResponse<Contract[]>>("/my/contracts"),
      ]);
      setReminders(reminderRes.data.data ?? []);
      setOwnedPlots(
        (contractRes.data.data ?? [])
          .filter((contract) =>
            ["active", "completed"].includes(contract.status),
          )
          .flatMap((contract) =>
            contract.plots?.length
              ? contract.plots.map((plot) => ({
                  ...contract,
                  plotId: plot.id,
                  plotCode: plot.code,
                  zoneName: plot.zoneName ?? undefined,
                }))
              : [contract],
          ),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useRealtimeRefresh(["reminders", "contracts", "ownership"], () =>
    loadAll(true),
  );

  // daysUntil "hiệu lực": ưu tiên giá trị backend trả về, nhưng với nhắc lịch
  // âm lịch thì luôn tính lại phía client để chắc chắn đúng năm hiện tại.
  function effectiveDaysUntil(r: Reminder): number | null {
    if (
      r.isRecurring &&
      r.calendarType === "lunar" &&
      r.remindDay &&
      r.remindMonth
    ) {
      return daysBetween(new Date(), effectiveNextDate(r).date as Date);
    }
    return r.daysUntil;
  }

  const upcoming = useMemo(() => {
    const active = reminders
      .filter((r) => r.isActive)
      .map((r) => ({ r, days: effectiveDaysUntil(r) }))
      .filter((x) => x.days !== null);
    active.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    return active[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders]);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".reminder-page .rm-reveal"),
    );
    if (!elements.length) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("is-visible");
          observer.unobserve(el);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [
    loading,
    reminders.length,
    editingId,
    isAuthenticated,
    error,
    upcoming?.r.id,
  ]);

  const sortedReminders = useMemo(() => {
    return [...reminders]
      .map((r) => ({ r, days: effectiveDaysUntil(r) }))
      .sort((a, b) => {
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return a.days - b.days;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders]);

  // Lịch tháng: ngày nào trùng nextDate của 1 nhắc lịch sẽ có chấm vàng
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const eventDates = new Set(
      reminders
        .filter((r) => r.isActive)
        .map((r) => effectiveNextDate(r).iso)
        .filter((iso): iso is string => Boolean(iso)),
    );

    const cells: { date: Date; otherMonth: boolean; iso: string }[] = [];
    for (let i = firstDow - 1; i >= 0; i--)
      cells.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        otherMonth: true,
        iso: "",
      });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({
        date,
        otherMonth: false,
        iso: date.toISOString().slice(0, 10),
      });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, otherMonth: true, iso: "" });
    }
    return cells.map((c) => ({
      ...c,
      isToday: c.date.toDateString() === today.toDateString(),
      hasEvent: !c.otherMonth && eventDates.has(c.iso),
    }));
  }, [viewMonth, reminders]);

  function goToLogin() {
    navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.REMINDERS } } });
  }

  function startCreate(prefillDate?: Date) {
    if (!isAuthenticated) return goToLogin();
    setEditingId(null);
    setFormError("");
    setFormOk("");
    setForm({
      ...emptyForm,
      specificDate: prefillDate ? prefillDate.toISOString().slice(0, 10) : "",
      isRecurring: !prefillDate,
    });
  }

  function startEdit(reminder: Reminder) {
    setEditingId(reminder.id);
    setFormError("");
    setFormOk("");
    setForm({
      title: reminder.title,
      description: reminder.description ?? "",
      plotId: reminder.plotId ?? null,
      reminderType: reminder.reminderType,
      isRecurring: reminder.isRecurring,
      calendarType: reminder.calendarType ?? "solar",
      remindMonth: reminder.remindMonth ?? "",
      remindDay: reminder.remindDay ?? "",
      specificDate: reminder.specificDate ?? "",
      notifyDaysBefore: reminder.notifyDaysBefore,
      notifyEmails: reminder.notifyEmails ?? [],
      notifyEmailDraft: "",
    });
  }

  /** Thêm 1 email vào danh sách nhận thông báo (ô nhập + nút "+"). */
  function addNotifyEmail() {
    const raw = form.notifyEmailDraft.trim().toLowerCase();
    if (!raw) return;
    if (!EMAIL_RE.test(raw)) {
      setFormError("Email không hợp lệ.");
      return;
    }
    if (form.notifyEmails.includes(raw)) {
      setFormError("Email này đã được thêm, vui lòng chọn email khác.");
      return;
    }
    setFormError("");
    setForm({
      ...form,
      notifyEmails: [...form.notifyEmails, raw],
      notifyEmailDraft: "",
    });
  }

  function removeNotifyEmail(email: string) {
    setForm({
      ...form,
      notifyEmails: form.notifyEmails.filter((e) => e !== email),
    });
  }

  async function submitForm() {
    if (!isAuthenticated) return goToLogin();
    if (!form.title.trim()) {
      setFormError("Vui lòng nhập tên sự kiện.");
      return;
    }
    if (form.isRecurring && (!form.remindMonth || !form.remindDay)) {
      setFormError("Vui lòng chọn tháng và ngày nhắc hàng năm.");
      return;
    }
    if (!form.isRecurring && !form.specificDate) {
      setFormError("Vui lòng chọn ngày cụ thể.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormOk("");
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        plotId: form.plotId ?? undefined,
        reminderType: form.reminderType,
        isRecurring: form.isRecurring,
        calendarType: form.isRecurring ? form.calendarType : undefined,
        remindMonth: form.isRecurring ? Number(form.remindMonth) : undefined,
        remindDay: form.isRecurring ? Number(form.remindDay) : undefined,
        specificDate: form.isRecurring ? undefined : form.specificDate,
        notifyDaysBefore: Number(form.notifyDaysBefore),
        notifyEmail: form.notifyEmails.length > 0,
        notifyEmails: form.notifyEmails,
      };
      if (editingId) {
        await api.patch(`/my/reminders/${editingId}`, payload);
        setFormOk("Đã cập nhật nhắc lịch.");
      } else {
        await api.post("/my/reminders", payload);
        setFormOk("Đã tạo nhắc lịch mới.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(reminder: Reminder) {
    try {
      await api.patch(`/my/reminders/${reminder.id}`, {
        isActive: !reminder.isActive,
      });
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function removeReminder(id: number) {
    if (!window.confirm("Xoá nhắc lịch này?")) return;
    try {
      await api.delete(`/my/reminders/${id}`);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function dayBadge(reminder: Reminder, days: number | null) {
    if (days === null) return { cls: "past", text: "Không lặp lại" };
    if (days === 0) return { cls: "soon", text: "Hôm nay" };
    if (days <= reminder.notifyDaysBefore)
      return { cls: "soon", text: `Còn ${days} ngày` };
    return { cls: "far", text: `Còn ${days} ngày` };
  }

  /** Điều hướng sang trang đặt dịch vụ cúng lễ, gắn kèm lô liên quan nếu có. */
  function goBookService(reminder: Reminder) {
    if (reminder.plotId)
      navigate(ROUTES.SERVICE_BOOK.replace(":lotId", String(reminder.plotId)));
    else navigate(ROUTES.SERVICES);
  }

  return (
    <div className="reminder-page">
      <div className="bg-canvas" aria-hidden="true" />
      <NavyStarfield starsOnly starCount={60} />

      <main>
        <header className="page-header rm-reveal">
          <div className="page-header-copy">
            <h1 className="page-title">Nhắc lịch ngày giỗ</h1>
            <p className="page-desc">
              Theo dõi ngày giỗ, lễ tưởng niệm và lịch chăm sóc phần mộ. Các
              lịch sắp tới được ưu tiên để bạn dễ kiểm tra và chuẩn bị.
            </p>
          </div>
        </header>

        {!isAuthenticated && (
          <div className="notice-banner rm-reveal">
            <Icon name="circleBell" size={18} />
            <span>Đăng nhập để tạo và quản lý nhắc lịch của bạn.</span>
            <button type="button" onClick={goToLogin}>
              Đăng nhập
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner rm-reveal">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {upcoming && (
          <section
            className="upcoming-card rm-reveal"
            aria-label="Nhắc lịch sắp tới"
          >
            <div className="upcoming-icon">
              <Icon name={TYPE_META[upcoming.r.reminderType].icon} size={24} />
            </div>
            <div className="upcoming-info">
              <div className="upcoming-label">Sắp đến</div>
              <div className="upcoming-title">{upcoming.r.title}</div>
              <div className="upcoming-meta">
                <span>
                  <Icon name="calendar" size={14} />{" "}
                  {formatDate(effectiveNextDate(upcoming.r).iso)}
                </span>
                {upcoming.r.plotCode && (
                  <span>
                    <Icon name="mapPin" size={14} /> Lô {upcoming.r.plotCode}
                  </span>
                )}
                {upcoming.r.calendarType === "lunar" &&
                  upcoming.r.remindDay &&
                  upcoming.r.remindMonth && (
                    <span>
                      <Icon name="moon" size={14} /> Âm lịch{" "}
                      {String(upcoming.r.remindDay).padStart(2, "0")}/
                      {String(upcoming.r.remindMonth).padStart(2, "0")}
                    </span>
                  )}
              </div>
            </div>
            <div className="upcoming-countdown">
              <strong>{upcoming.days}</strong>
              <span>{upcoming.days === 0 ? "hôm nay" : "ngày nữa"}</span>
            </div>
            <button
              type="button"
              className="upcoming-btn"
              onClick={() => goBookService(upcoming.r)}
            >
              Đặt dịch vụ <Icon name="arrowRight" size={16} />
            </button>
          </section>
        )}

        <div className="content-grid">
          <div className="content-main">
            <section className="calendar-card rm-reveal">
              <div className="card-heading">
                <div>
                  <div className="card-kicker">Lịch tháng</div>
                  <h2>
                    {viewMonth.toLocaleDateString("vi-VN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                </div>
                <div className="cal-nav" aria-label="Điều hướng tháng">
                  <button
                    type="button"
                    className="cal-nav-btn"
                    aria-label="Tháng trước"
                    onClick={() =>
                      setViewMonth(
                        new Date(
                          viewMonth.getFullYear(),
                          viewMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    <Icon name="chevronLeft" size={18} />
                  </button>
                  <button
                    type="button"
                    className="cal-nav-btn"
                    aria-label="Tháng sau"
                    onClick={() =>
                      setViewMonth(
                        new Date(
                          viewMonth.getFullYear(),
                          viewMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    <Icon name="chevronRight" size={18} />
                  </button>
                </div>
              </div>

              <div className="calendar-legend">
                <span>
                  <i className="legend-dot today-dot" />
                  Hôm nay
                </span>
                <span>
                  <i className="legend-dot event-dot" />
                  Có nhắc lịch
                </span>
                <span className="calendar-tip">
                  Chọn một ngày để tạo lịch nhanh
                </span>
              </div>

              <div className="cal-grid">
                {DOW.map((d) => (
                  <div key={d} className="cal-dow">
                    {d}
                  </div>
                ))}
                {calendarDays.map((c, i) => (
                  <button
                    type="button"
                    key={i}
                    className={[
                      "cal-day",
                      c.otherMonth ? "other-month" : "",
                      c.isToday ? "today" : "",
                      c.hasEvent ? "has-event" : "",
                      selectedDay &&
                      c.date.toDateString() === selectedDay.toDateString()
                        ? "selected"
                        : "",
                    ]
                      .join(" ")
                      .trim()}
                    onClick={() => {
                      setSelectedDay(c.date);
                      startCreate(c.date);
                    }}
                    aria-label={`${c.date.getDate()}/${c.date.getMonth() + 1}/${c.date.getFullYear()}${c.hasEvent ? ", có nhắc lịch" : ""}`}
                  >
                    <span>{c.date.getDate()}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="reminders-section rm-reveal">
              <div className="list-heading">
                <div>
                  <div className="card-kicker">Lịch của bạn</div>
                  <h2>Danh sách nhắc lịch</h2>
                </div>
                {!loading && (
                  <span className="list-count">
                    {sortedReminders.length} lịch
                  </span>
                )}
              </div>

              {loading ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon name="clock" size={24} />
                  </div>
                  <p>Đang tải nhắc lịch...</p>
                </div>
              ) : sortedReminders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon name="calendar" size={24} />
                  </div>
                  <h3>Chưa có nhắc lịch</h3>
                  <p>
                    Chọn một ngày trên lịch hoặc dùng biểu mẫu bên cạnh để tạo
                    nhắc lịch đầu tiên.
                  </p>
                </div>
              ) : (
                <div className="reminder-list">
                  {sortedReminders.map(({ r, days }, index) => {
                    const meta = TYPE_META[r.reminderType];
                    const badge = dayBadge(r, days);
                    const eff = effectiveNextDate(r);
                    const emailLabel =
                      r.notifyEmails && r.notifyEmails.length > 0
                        ? r.notifyEmails.length > 1
                          ? `${r.notifyEmails.length} email`
                          : r.notifyEmails[0]
                        : r.notifyEmail
                          ? "Email"
                          : null;
                    return (
                      <article
                        key={r.id}
                        className={`reminder-item rm-reveal ${badge.cls === "soon" ? "upcoming-soon" : ""} ${r.isActive ? "" : "inactive"}`}
                        style={
                          {
                            "--reveal-delay": `${Math.min(index * 0.05, 0.3)}s`,
                          } as CSSProperties
                        }
                      >
                        <div className={`r-icon ${meta.dot}`}>
                          <Icon name={meta.icon} size={19} />
                        </div>
                        <div className="r-body">
                          <div className="r-name-row">
                            <h3 className="r-name">{r.title}</h3>
                            {!r.isActive && (
                              <span className="status-chip">Đã tạm tắt</span>
                            )}
                          </div>
                          <div className="r-meta-row">
                            <span>{meta.label}</span>
                            {r.plotCode && (
                              <span>
                                <Icon name="mapPin" size={13} /> Lô {r.plotCode}
                              </span>
                            )}
                            <span>
                              <Icon
                                name={r.isRecurring ? "repeat" : "calendar"}
                                size={13}
                              />{" "}
                              {r.isRecurring
                                ? r.calendarType === "lunar"
                                  ? "Âm lịch · Hàng năm"
                                  : "Hàng năm"
                                : "Một lần"}
                            </span>
                            {emailLabel && (
                              <span>
                                <Icon name="mail" size={13} /> {emailLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="r-schedule">
                          <div className="r-date">{formatDate(eff.iso)}</div>
                          <span className={`r-days ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </div>
                        <div className="r-actions">
                          <button
                            type="button"
                            className="r-btn"
                            aria-label="Đặt dịch vụ"
                            title="Đặt dịch vụ"
                            onClick={() => goBookService(r)}
                          >
                            <Icon name="service" size={16} />
                          </button>
                          <button
                            type="button"
                            className="r-btn"
                            aria-label={r.isActive ? "Tạm tắt" : "Bật lại"}
                            title={r.isActive ? "Tạm tắt" : "Bật lại"}
                            onClick={() => void toggleActive(r)}
                          >
                            <Icon
                              name={r.isActive ? "pause" : "play"}
                              size={16}
                            />
                          </button>
                          <button
                            type="button"
                            className="r-btn"
                            aria-label="Sửa"
                            title="Sửa"
                            onClick={() => startEdit(r)}
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="r-btn danger"
                            aria-label="Xoá"
                            title="Xoá"
                            onClick={() => void removeReminder(r.id)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="add-panel rm-reveal">
            <div className="add-panel-header">
              <div>
                <div className="card-kicker">
                  {editingId ? "Chỉnh sửa" : "Tạo mới"}
                </div>
                <h2>{editingId ? "Sửa nhắc lịch" : "Thêm nhắc lịch"}</h2>
              </div>
              {editingId && (
                <button
                  type="button"
                  className="cancel-edit"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  <Icon name="x" size={15} /> Huỷ
                </button>
              )}
            </div>

            <div className="field">
              <label htmlFor="reminder-title">Tên sự kiện</label>
              <input
                id="reminder-title"
                placeholder="Ví dụ: Ngày giỗ ông Nguyễn Văn A"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Loại sự kiện</label>
              <div className="type-grid event-type-grid">
                {(Object.keys(TYPE_META) as ReminderType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`type-opt ${form.reminderType === t ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, reminderType: t })}
                  >
                    <span className="type-opt-icon">
                      <Icon name={TYPE_META[t].icon} size={18} />
                    </span>
                    <span className="type-opt-name">{TYPE_META[t].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Tần suất</label>
              <div className="type-grid">
                <button
                  type="button"
                  className={`type-opt horizontal ${form.isRecurring ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, isRecurring: true })}
                >
                  <span className="type-opt-icon">
                    <Icon name="repeat" size={18} />
                  </span>
                  <span className="type-opt-name">Hàng năm</span>
                </button>
                <button
                  type="button"
                  className={`type-opt horizontal ${!form.isRecurring ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, isRecurring: false })}
                >
                  <span className="type-opt-icon">
                    <Icon name="calendar" size={18} />
                  </span>
                  <span className="type-opt-name">Một lần</span>
                </button>
              </div>
            </div>

            {form.isRecurring && (
              <div className="field">
                <label>Loại lịch nhắc</label>
                <div className="type-grid">
                  <button
                    type="button"
                    className={`type-opt horizontal ${form.calendarType === "solar" ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, calendarType: "solar" })}
                  >
                    <span className="type-opt-icon">
                      <Icon name="sun" size={18} />
                    </span>
                    <span className="type-opt-name">Dương lịch</span>
                  </button>
                  <button
                    type="button"
                    className={`type-opt horizontal ${form.calendarType === "lunar" ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, calendarType: "lunar" })}
                  >
                    <span className="type-opt-icon">
                      <Icon name="moon" size={18} />
                    </span>
                    <span className="type-opt-name">Âm lịch</span>
                  </button>
                </div>
              </div>
            )}

            {form.isRecurring ? (
              <div className="field field-row">
                <div>
                  <label htmlFor="reminder-month">
                    Tháng (
                    {form.calendarType === "lunar" ? "âm lịch" : "dương lịch"})
                  </label>
                  <select
                    id="reminder-month"
                    value={form.remindMonth}
                    onChange={(e) =>
                      setForm({ ...form, remindMonth: e.target.value })
                    }
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reminder-day">Ngày</label>
                  <select
                    id="reminder-day"
                    value={form.remindDay}
                    onChange={(e) =>
                      setForm({ ...form, remindDay: e.target.value })
                    }
                  >
                    <option value="">--</option>
                    {Array.from(
                      { length: form.calendarType === "lunar" ? 30 : 31 },
                      (_, i) => i + 1,
                    ).map((d) => (
                      <option key={d} value={d}>
                        Ngày {d}
                      </option>
                    ))}
                  </select>
                </div>
                {form.calendarType === "lunar" &&
                  form.remindDay &&
                  form.remindMonth && (
                    <div className="lunar-preview">
                      <Icon name="calendar" size={14} />
                      <span>
                        Dương lịch gần nhất:{" "}
                        {formatDate(
                          nextLunarOccurrence(
                            Number(form.remindDay),
                            Number(form.remindMonth),
                          )
                            .toISOString()
                            .slice(0, 10),
                        )}
                      </span>
                    </div>
                  )}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="specific-date">Ngày cụ thể</label>
                <input
                  id="specific-date"
                  type="date"
                  value={form.specificDate}
                  onChange={(e) =>
                    setForm({ ...form, specificDate: e.target.value })
                  }
                />
              </div>
            )}

            {ownedPlots.length > 0 && (
              <div className="field">
                <label htmlFor="plot-select">
                  Lô phần mộ liên quan <span>Không bắt buộc</span>
                </label>
                <select
                  id="plot-select"
                  value={form.plotId ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      plotId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">— Không chọn —</option>
                  {ownedPlots.map((p) => (
                    <option key={p.plotId} value={p.plotId}>
                      {p.plotCode}
                      {p.zoneName ? ` · ${p.zoneName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="notify-before">Nhắc trước</label>
              <select
                id="notify-before"
                value={form.notifyDaysBefore}
                onChange={(e) =>
                  setForm({ ...form, notifyDaysBefore: Number(e.target.value) })
                }
              >
                {[0, 1, 3, 5, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "Đúng ngày" : `${d} ngày trước`}
                  </option>
                ))}
              </select>
            </div>

            <div className="field notify-field">
              <label htmlFor="notify-email">
                Kênh nhận thông báo <span>Gmail</span>
              </label>
              <div className="notify-email-row">
                <div className="input-with-icon">
                  <Icon name="mail" size={16} />
                  <input
                    id="notify-email"
                    type="email"
                    placeholder="ten@gmail.com"
                    value={form.notifyEmailDraft}
                    onChange={(e) => {
                      setForm({ ...form, notifyEmailDraft: e.target.value });
                      if (formError) setFormError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNotifyEmail();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="notify-email-add"
                  aria-label="Thêm email"
                  title="Thêm email"
                  onClick={addNotifyEmail}
                >
                  <Icon name="plus" size={18} />
                </button>
              </div>
              {form.notifyEmails.length > 0 && (
                <div className="notify-email-list">
                  {form.notifyEmails.map((email) => (
                    <div key={email} className="notify-email-chip">
                      <Icon name="mail" size={13} />
                      <span>{email}</span>
                      <button
                        type="button"
                        className="notify-email-remove"
                        aria-label={`Xoá ${email}`}
                        onClick={() => removeNotifyEmail(email)}
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="field-hint">
                Có thể thêm một hoặc nhiều Gmail cùng nhận thông báo.
              </p>
            </div>

            <div className="field">
              <label htmlFor="reminder-note">
                Ghi chú <span>Không bắt buộc</span>
              </label>
              <textarea
                id="reminder-note"
                rows={3}
                placeholder="Ghi chú thêm..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            {formError && (
              <div className="form-error">
                <Icon name="alert" size={16} />
                <span>{formError}</span>
              </div>
            )}
            {formOk && (
              <div className="form-success">
                <Icon name="check" size={16} />
                <span>{formOk}</span>
              </div>
            )}

            <button
              type="button"
              className="btn-add"
              onClick={() => void submitForm()}
              disabled={submitting}
            >
              <Icon name={editingId ? "check" : "plus"} size={17} />
              {submitting
                ? "Đang lưu..."
                : editingId
                  ? "Lưu thay đổi"
                  : "Thêm nhắc lịch"}
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
