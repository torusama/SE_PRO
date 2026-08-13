import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  ReceiptText,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import DemoPaymentPanel from "@/components/payment/DemoPaymentPanel";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import {
  AppointmentBookingPanel,
  type AppointmentDraft,
} from "@/pages/customer/appointments/AppointmentBookingForm";
import ServiceScheduleCalendar from "@/pages/customer/service/ServiceScheduleCalendar";
import type { AgentResponse } from "./agent.types";
import "./AgentWorkflowPanel.css";

type Directive = NonNullable<AgentResponse["uiDirective"]>;

interface Props {
  directive: Directive;
  onClose: () => void;
  onDirectiveChange?: (directive: Directive) => void;
  onSendMessage?: (message: string) => void | Promise<void>;
  onAssistantNotice?: (message: string) => void;
}

interface ServiceOrderDetail {
  id: number;
  serviceName?: string;
  plotCode?: string;
  requestedDate?: string | null;
  scheduledDate?: string | null;
  amount?: number | string;
  status?: string;
  paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
  paymentCode?: string | null;
  paidAt?: string | null;
  paymentConfirmedAt?: string | null;
}

interface CalendarEntry {
  id: number;
  title?: string;
  appointmentDate?: string;
  requestedDate?: string;
  specificDate?: string;
  remindMonth?: number;
  remindDay?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
}

function formatMoney(value: number | string | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("vi-VN")} VND`
    : "—";
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso() {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function clockMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function describeError(error: unknown, fallback: string) {
  const requestError = error as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = requestError.response?.data?.message;
  if (Array.isArray(message)) return message.join(". ");
  return message || fallback;
}

function CalendarPreview({
  date,
  interactive = false,
  onSelect,
}: {
  date?: string;
  interactive?: boolean;
  onSelect?: (date: string) => void;
}) {
  const initial =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00`)
      : new Date();
  const [cursor, setCursor] = useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), 1),
  );

  useEffect(() => {
    const selected =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00`)
        : null;
    if (selected) {
      setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [date]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: offset + days }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  const minDate = todayIso();

  return (
    <div className="agent-workflow-calendar">
      <div className="agent-workflow-calendar-head">
        {interactive ? (
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Tháng trước"
          >
            <ChevronLeft size={15} />
          </button>
        ) : (
          <span />
        )}
        <strong>
          Tháng {month + 1}/{year}
        </strong>
        {interactive ? (
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Tháng sau"
          >
            <ChevronRight size={15} />
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="agent-workflow-weekdays">
        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="agent-workflow-days">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const value = isoDate(year, month, day);
          const isPast = value < minDate;
          const isSelected = value === date;
          if (!interactive) {
            return (
              <span key={value} className={isSelected ? "is-selected" : ""}>
                {day}
              </span>
            );
          }
          return (
            <button
              key={value}
              type="button"
              className={isSelected ? "is-selected" : ""}
              disabled={isPast}
              onClick={() => onSelect?.(value)}
              aria-label={`Chọn ngày ${day}/${month + 1}/${year}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServiceProgress({ stage }: { stage: "payment" | "calendar" }) {
  return (
    <div
      className="agent-workflow-progress"
      aria-label="Tiến trình đặt dịch vụ"
    >
      <div className="is-complete">
        <span>
          <CheckCircle2 size={14} />
        </span>
        <small>Đã đặt</small>
      </div>
      <i />
      <div className={stage === "payment" ? "is-current" : "is-complete"}>
        <span>
          {stage === "calendar" ? (
            <CheckCircle2 size={14} />
          ) : (
            <CreditCard size={14} />
          )}
        </span>
        <small>Thanh toán</small>
      </div>
      <i />
      <div className={stage === "calendar" ? "is-current" : ""}>
        <span>
          <CalendarDays size={14} />
        </span>
        <small>Xem lịch</small>
      </div>
    </div>
  );
}

export default function AgentWorkflowPanel({
  directive,
  onClose,
  onDirectiveChange,
  onSendMessage,
  onAssistantNotice,
}: Props) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ServiceOrderDetail[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentStartTime, setAppointmentStartTime] = useState("09:00");
  const [appointmentEndTime, setAppointmentEndTime] = useState("10:00");
  const [appointmentDirty, setAppointmentDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const autoAdvancedOrderRef = useRef<number | null>(null);
  const previousPaymentStatusesRef = useRef<
    Map<number, ServiceOrderDetail["paymentStatus"]>
  >(new Map());

  const serviceOrderId =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
    directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
      ? directive.orderId
      : undefined;
  const serviceOrderIds =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
    directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
      ? Array.from(
          new Set(
            (directive.orderIds?.length
              ? directive.orderIds
              : [directive.orderId]
            ).filter((id): id is number => typeof id === "number"),
          ),
        )
      : [];
  const serviceOrderIdsKey = serviceOrderIds.join(",");
  const order = orders[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (
        directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
        directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
      ) {
        const ids = serviceOrderIdsKey
          .split(",")
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0);
        if (!ids.length) {
          setError("Chưa xác định được đơn dịch vụ cần xử lý.");
          return;
        }
        const details = await Promise.all(
          ids.map(async (id) => {
            const response = await api.get(`/my/service-orders/${id}`);
            return (response.data?.data ?? null) as ServiceOrderDetail | null;
          }),
        );
        setOrders(
          details.filter((item): item is ServiceOrderDetail => Boolean(item)),
        );
      } else if (directive.type === "OPEN_APPOINTMENT_CALENDAR") {
        const response = await api.get("/schedule/appointments/me");
        setEntries(response.data?.data ?? []);
      } else if (directive.type === "OPEN_REMINDER_CALENDAR") {
        const response = await api.get("/my/reminders");
        setEntries(response.data?.data ?? []);
      }
    } catch (loadError) {
      setError(
        describeError(
          loadError,
          "Chưa thể tải dữ liệu mới nhất. Vui lòng thử lại.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [directive.type, serviceOrderIdsKey]);

  useEffect(() => {
    setNotice("");
    setError("");
    void load();
  }, [load]);

  useRealtimeRefresh(["services"], load);

  useEffect(() => {
    if (!orders.length) return;
    const previous = previousPaymentStatusesRef.current;
    if (!previous.size) {
      orders.forEach((item) => previous.set(item.id, item.paymentStatus));
      return;
    }
    for (const item of orders) {
      const before = previous.get(item.id);
      if (
        before === "awaiting_confirmation" &&
        item.paymentStatus === "paid"
      ) {
        onAssistantNotice?.(
          `Ban quản lý đã xác nhận thanh toán đơn dịch vụ #${item.id} – ${item.serviceName || "Dịch vụ chăm sóc"}. Mình đã chuyển đơn này sang lịch thực hiện với ngày ${item.scheduledDate || item.requestedDate || "đã ghi nhận"}.`,
        );
      }
      previous.set(item.id, item.paymentStatus);
    }
  }, [onAssistantNotice, orders]);

  useEffect(() => {
    previousPaymentStatusesRef.current = new Map();
    autoAdvancedOrderRef.current = null;
  }, [serviceOrderIdsKey]);

  useEffect(() => {
    if (directive.type !== "OPEN_APPOINTMENT_CALENDAR") return;
    setAppointmentDate(directive.appointmentDate ?? "");
    setAppointmentStartTime(directive.startTime ?? "09:00");
    setAppointmentEndTime(directive.endTime ?? "10:00");
    setAppointmentDirty(false);
  }, [directive]);

  useEffect(() => {
    if (
      directive.type !== "SHOW_INLINE_SERVICE_PAYMENT" ||
      !orders.length ||
      orders.some((item) => item.paymentStatus !== "paid") ||
      autoAdvancedOrderRef.current === orders[0].id
    ) {
      return;
    }
    autoAdvancedOrderRef.current = orders[0].id;
    const timer = window.setTimeout(() => {
      onDirectiveChange?.({
        type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
        orderId: orders[0].id,
        orderIds: orders.map((item) => item.id),
        requestedDate: orders[0].requestedDate ?? undefined,
        scheduledDate: orders[0].scheduledDate ?? undefined,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [directive.type, onDirectiveChange, orders]);

  useEffect(() => {
    if (
      directive.type !== "OPEN_SERVICE_SCHEDULE_CALENDAR" ||
      !orders.length ||
      orders.every((item) => item.paymentStatus === "paid")
    ) {
      return;
    }
    onDirectiveChange?.({
      type: "SHOW_INLINE_SERVICE_PAYMENT",
      orderId: orders[0].id,
      orderIds: orders.map((item) => item.id),
      amount: orders.reduce((total, item) => total + Number(item.amount ?? 0), 0),
      paymentStatus: orders[0].paymentStatus ?? "unpaid",
    });
  }, [directive.type, onDirectiveChange, orders]);

  const selectedDate = useMemo(() => {
    if (directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR") {
      return (
        order?.scheduledDate ||
        order?.requestedDate ||
        directive.requestedDate ||
        directive.scheduledDate
      );
    }
    if (directive.type === "OPEN_APPOINTMENT_CALENDAR") {
      return appointmentDate || directive.appointmentDate;
    }
    if (directive.type === "OPEN_REMINDER_CALENDAR") {
      return directive.reminderDate;
    }
    return undefined;
  }, [appointmentDate, directive, order]);

  const appointmentMode = useMemo(() => {
    if (directive.type !== "OPEN_APPOINTMENT_CALENDAR") return null;
    if (directive.mode) return directive.mode;
    if (directive.appointmentId) return "summary" as const;
    if (directive.appointmentDate && directive.startTime)
      return "review" as const;
    return "collecting" as const;
  }, [directive]);

  async function submitAppointment(draft?: AppointmentDraft) {
    if (
      directive.type !== "OPEN_APPOINTMENT_CALENDAR" ||
      appointmentMode === "summary" ||
      appointmentSubmitting ||
      !onSendMessage
    ) {
      return;
    }

    if (appointmentMode === "review" && !appointmentDirty) {
      setAppointmentSubmitting(true);
      setError("");
      try {
        await onSendMessage("Mình xác nhận đặt lịch này.");
      } finally {
        setAppointmentSubmitting(false);
      }
      return;
    }

    const selectedDraft =
      draft ??
      ({
        date: appointmentDate,
        startTime: appointmentStartTime,
        endTime: appointmentEndTime,
        topic: directive.plotCode
          ? `Hẹn xem lô đất ${directive.plotCode}`
          : "Hẹn xem lô đất",
        note: "",
      } satisfies AppointmentDraft);

    if (!selectedDraft.date || selectedDraft.date < todayIso()) {
      setError("Bạn chọn một ngày từ hôm nay trở đi để tiếp tục.");
      return;
    }
    if (
      !selectedDraft.startTime ||
      !selectedDraft.endTime ||
      !Number.isFinite(clockMinutes(selectedDraft.startTime)) ||
      !Number.isFinite(clockMinutes(selectedDraft.endTime)) ||
      clockMinutes(selectedDraft.endTime) <=
        clockMinutes(selectedDraft.startTime)
    ) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    if (!directive.plotCode) {
      setError("Chưa xác định được lô đã duyệt mà bạn muốn xem.");
      return;
    }
    setAppointmentSubmitting(true);
    setError("");
    try {
      await onSendMessage(
        `Mình muốn đặt lịch hẹn xem lô ${directive.plotCode} vào ngày ${selectedDraft.date}, từ ${selectedDraft.startTime} đến ${selectedDraft.endTime}.`,
      );
      setAppointmentDirty(false);
    } finally {
      setAppointmentSubmitting(false);
    }
  }

  const title =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT"
      ? "Đơn dịch vụ & thanh toán"
      : directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
        ? "Lịch thực hiện dịch vụ"
        : directive.type === "OPEN_APPOINTMENT_CALENDAR"
          ? "Lịch hẹn với ban quản lý"
          : "Lịch nhắc tưởng niệm";

  const headerIcon =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ? (
      <ReceiptText size={15} />
    ) : (
      <CalendarDays size={15} />
    );

  return (
    <aside
      className={`agent-workflow-panel ${directive.type === "OPEN_APPOINTMENT_CALENDAR" ? "is-appointment" : ""}`}
      aria-label={title}
    >
      <button
        className="agent-workflow-close"
        type="button"
        onClick={onClose}
        aria-label="Đóng bảng"
      >
        <X size={18} />
      </button>
      <header>
        <span>{headerIcon}</span>
        <div>
          <small>Trợ lý đang hỗ trợ</small>
          <h2>{title}</h2>
        </div>
      </header>

      {error && <p className="agent-workflow-error">{error}</p>}
      {notice && <p className="agent-workflow-success">{notice}</p>}
      {loading && (
        <p className="agent-workflow-loading">
          <LoaderCircle size={14} className="spin" /> Đang đồng bộ dữ liệu…
        </p>
      )}

      {directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ? (
        <div
          key={`service-payment-${serviceOrderIdsKey || "new"}`}
          className="agent-workflow-content"
        >
          <ServiceProgress stage="payment" />
          {orders.length ? (
            orders.map((item) => (
              <section
                key={item.id}
                className="agent-workflow-service-item"
                aria-label={`Đơn dịch vụ #${item.id}`}
              >
                <section className="agent-workflow-order-summary is-payment-summary">
                  <small>Đơn dịch vụ #{item.id}</small>
                  <h3>{item.serviceName || "Dịch vụ chăm sóc"}</h3>
                  <div>
                    <span>Lô áp dụng</span>
                    <strong>{item.plotCode || "—"}</strong>
                  </div>
                  <div>
                    <span>Ngày mong muốn</span>
                    <strong>{item.requestedDate || "—"}</strong>
                  </div>
                  <div>
                    <span>Chi phí</span>
                    <strong>{formatMoney(item.amount)}</strong>
                  </div>
                </section>

                {item.paymentStatus === "paid" ? (
                  <ServiceScheduleCalendar
                    requestedDate={item.requestedDate ?? undefined}
                    scheduledDate={item.scheduledDate ?? undefined}
                    serviceName={item.serviceName}
                    plotCode={item.plotCode}
                  />
                ) : (
                  <DemoPaymentPanel
                    orderId={item.id}
                    amount={Number(item.amount ?? 0)}
                    paymentStatus={item.paymentStatus ?? "unpaid"}
                    paymentCode={item.paymentCode}
                    paidAt={item.paidAt}
                    paymentConfirmedAt={item.paymentConfirmedAt}
                    variant="customer"
                    onChanged={load}
                  />
                )}
                {item.paymentStatus === "awaiting_confirmation" && (
                  <p className="agent-workflow-calendar-note">
                    Đơn #{item.id} đang chờ ban quản lý duyệt thanh toán. Khi
                    được duyệt, lịch của riêng dịch vụ này sẽ tự xuất hiện.
                  </p>
                )}
              </section>
            ))
          ) : (
            <p className="agent-workflow-error">
              Chưa xác định được đơn dịch vụ cần thanh toán.
            </p>
          )}
          <button
            type="button"
            className="agent-workflow-link"
            onClick={() =>
              navigate(
                serviceOrderId
                  ? `${ROUTES.SERVICES}?tab=track&order=${serviceOrderId}`
                  : ROUTES.SERVICES,
              )
            }
          >
            Xem đơn dịch vụ của tôi
          </button>
        </div>
      ) : directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR" ? (
        <div
          key={`service-calendar-${serviceOrderIdsKey}`}
          className="agent-workflow-content"
        >
          <ServiceProgress stage="calendar" />
          {orders.map((item) => (
            <section
              key={item.id}
              className="agent-workflow-service-item"
              aria-label={`Lịch dịch vụ #${item.id}`}
            >
              <section className="agent-workflow-order-summary">
                <small>Đơn dịch vụ #{item.id}</small>
                <h3>{item.serviceName || "Dịch vụ chăm sóc"}</h3>
                <div>
                  <span>Lô áp dụng</span>
                  <strong>{item.plotCode || "—"}</strong>
                </div>
                <div>
                  <span>Chi phí</span>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
                <div>
                  <span>Thanh toán</span>
                  <strong>Đã xác nhận</strong>
                </div>
              </section>
              <ServiceScheduleCalendar
                requestedDate={item.requestedDate ?? undefined}
                scheduledDate={item.scheduledDate ?? undefined}
                serviceName={item.serviceName}
                plotCode={item.plotCode}
              />
            </section>
          ))}
          <p className="agent-workflow-calendar-note">
            Đây là ngày bạn đã xác nhận trong cuộc trò chuyện. Muốn đổi ngày,
            hãy nhắn lại cho trợ lý thay vì phải xác nhận thêm trong panel.
          </p>
          <button
            type="button"
            className="agent-workflow-link"
            onClick={() =>
              navigate(
                `${ROUTES.SERVICES}?tab=track&order=${directive.orderId}`,
              )
            }
          >
            Xem lịch & đơn dịch vụ của tôi
          </button>
        </div>
      ) : directive.type === "OPEN_APPOINTMENT_CALENDAR" ? (
        <div
          key={`appointment-${appointmentMode}-${directive.appointmentId ?? "draft"}`}
          className="agent-workflow-content agent-workflow-appointment-content"
        >
          {directive.plotCode && (
            <section
              className="agent-workflow-selected-plot"
              aria-label="Lô đã chọn cho lịch hẹn"
            >
              <span>Lô đã được duyệt và do bạn chọn</span>
              <strong>{directive.plotCode}</strong>
            </section>
          )}

          {appointmentMode === "summary" ? (
            <>
              <CalendarPreview date={selectedDate} />
              <section className="agent-workflow-order-summary agent-workflow-appointment-summary">
                <small>
                  {directive.appointmentId
                    ? `Lịch hẹn #${directive.appointmentId}`
                    : "Yêu cầu lịch hẹn"}
                </small>
                <h3>{directive.topic || "Trao đổi với ban quản lý"}</h3>
                <div>
                  <span>Ngày</span>
                  <strong>{directive.appointmentDate || "—"}</strong>
                </div>
                <div>
                  <span>Thời gian</span>
                  <strong>
                    {directive.startTime || "—"}
                    {directive.endTime ? `–${directive.endTime}` : ""}
                  </strong>
                </div>
                <div>
                  <span>Lô trao đổi</span>
                  <strong>{directive.plotCode || "—"}</strong>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <strong>Chờ ban quản lý xác nhận</strong>
                </div>
              </section>

              {entries.length > 0 && (
                <section className="agent-workflow-schedule">
                  <div>
                    <span>Lịch gần đây</span>
                    <strong>{entries.length}</strong>
                  </div>
                  {entries.slice(0, 3).map((entry) => (
                    <article
                      key={entry.id}
                      className={
                        entry.id === directive.appointmentId ? "is-current" : ""
                      }
                    >
                      <strong>{entry.title || "Hẹn với ban quản lý"}</strong>
                      <span>
                        {entry.appointmentDate || "Chưa xác định ngày"}
                      </span>
                      {entry.startTime && (
                        <small>
                          {entry.startTime.slice(0, 5)}
                          {entry.endTime
                            ? `–${entry.endTime.slice(0, 5)}`
                            : ""}{" "}
                          · {entry.status || "đang chờ"}
                        </small>
                      )}
                    </article>
                  ))}
                </section>
              )}

              <button
                type="button"
                className="agent-workflow-primary"
                onClick={() =>
                  navigate(
                    directive.appointmentId
                      ? `${ROUTES.APPOINTMENTS}?appointment=${directive.appointmentId}`
                      : ROUTES.APPOINTMENTS,
                  )
                }
              >
                <CalendarDays size={15} /> Xem lịch hẹn của tôi
              </button>
            </>
          ) : (
            <>
              <AppointmentBookingPanel
                eyebrow="Hẹn xem lô đã duyệt"
                title={`Chọn lịch xem lô ${directive.plotCode ?? ""}`.trim()}
                meta="Mục đích cố định: xem lô đất"
                fixedPurpose={
                  directive.plotCode
                    ? `Hẹn xem lô đất ${directive.plotCode}`
                    : "Hẹn xem lô đất"
                }
                value={{
                  date: appointmentDate,
                  startTime: appointmentStartTime,
                  endTime: appointmentEndTime,
                  topic: directive.plotCode
                    ? `Hẹn xem lô đất ${directive.plotCode}`
                    : "Hẹn xem lô đất",
                  plotCode: directive.plotCode ?? "",
                  note: "",
                }}
                onChange={(draft) => {
                  setAppointmentDate(draft.date);
                  setAppointmentStartTime(draft.startTime);
                  setAppointmentEndTime(draft.endTime);
                  setAppointmentDirty(true);
                }}
                onSubmit={submitAppointment}
                submitting={appointmentSubmitting}
                disabled={!onSendMessage}
                submitIcon={
                  appointmentMode === "review" && !appointmentDirty ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <CalendarDays size={15} />
                  )
                }
                submitLabel={
                  appointmentMode === "review" && !appointmentDirty
                    ? "Xác nhận đặt lịch"
                    : appointmentMode === "review"
                      ? "Cập nhật lịch hẹn"
                      : "Tiếp tục với lịch này"
                }
                helperText={
                  appointmentMode === "review" && !appointmentDirty
                    ? "Thời gian đã đủ. Hệ thống chỉ tạo lịch sau khi bạn xác nhận; trước đó chưa có yêu cầu nào được gửi cho ban quản lý."
                    : "Chọn ngày và giờ trong biểu mẫu dùng chung của trang Lịch hẹn. Trợ lý sẽ dùng đúng lô ở trên để chuẩn bị yêu cầu."
                }
              />
              <button
                type="button"
                className="agent-workflow-link agent-workflow-appointment-page-link"
                onClick={() => navigate(ROUTES.APPOINTMENTS)}
              >
                <CalendarDays size={15} /> Mở trang Lịch hẹn của tôi
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          key={`reminder-${directive.reminderId ?? "calendar"}`}
          className="agent-workflow-content"
        >
          <CalendarPreview date={selectedDate} />
          <section className="agent-workflow-schedule">
            <div>
              <span>Tổng lịch</span>
              <strong>{entries.length}</strong>
            </div>
            {entries.slice(0, 4).map((entry) => (
              <article
                key={entry.id}
                className={
                  entry.id === directive.reminderId ? "is-current" : ""
                }
              >
                <strong>{entry.title || "Lịch tưởng niệm"}</strong>
                <span>
                  {entry.appointmentDate ||
                    entry.specificDate ||
                    (entry.remindDay && entry.remindMonth
                      ? `${entry.remindDay}/${entry.remindMonth} hằng năm`
                      : "Chưa xác định ngày")}
                </span>
                {entry.startTime && (
                  <small>
                    {entry.startTime.slice(0, 5)}
                    {entry.endTime
                      ? `–${entry.endTime.slice(0, 5)}`
                      : ""} · {entry.status || "đang chờ"}
                  </small>
                )}
              </article>
            ))}
          </section>
          <button
            type="button"
            className="agent-workflow-primary"
            onClick={() => navigate(ROUTES.REMINDERS)}
          >
            Xem lịch đầy đủ
          </button>
        </div>
      )}
    </aside>
  );
}
