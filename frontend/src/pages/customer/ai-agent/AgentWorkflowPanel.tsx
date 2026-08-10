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
import type { AgentResponse } from "./agent.types";
import "./AgentWorkflowPanel.css";

type Directive = NonNullable<AgentResponse["uiDirective"]>;
type ScheduleDirective = Extract<
  Directive,
  { type: "OPEN_SERVICE_SCHEDULE_CALENDAR" }
>;

interface Props {
  directive: Directive;
  onClose: () => void;
  onDirectiveChange?: (directive: Directive) => void;
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
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} VND` : "—";
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso() {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
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
    <div className="agent-workflow-progress" aria-label="Tiến trình đặt dịch vụ">
      <div className="is-complete">
        <span><CheckCircle2 size={14} /></span>
        <small>Đã đặt</small>
      </div>
      <i />
      <div className={stage === "payment" ? "is-current" : "is-complete"}>
        <span>{stage === "calendar" ? <CheckCircle2 size={14} /> : <CreditCard size={14} />}</span>
        <small>Thanh toán</small>
      </div>
      <i />
      <div className={stage === "calendar" ? "is-current" : ""}>
        <span><CalendarDays size={14} /></span>
        <small>Chọn lịch</small>
      </div>
    </div>
  );
}

export default function AgentWorkflowPanel({
  directive,
  onClose,
  onDirectiveChange,
}: Props) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selectedServiceDate, setSelectedServiceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const autoAdvancedOrderRef = useRef<number | null>(null);

  const serviceOrderId =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
    directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
      ? directive.orderId
      : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (
        directive.type === "SHOW_INLINE_SERVICE_PAYMENT" ||
        directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
      ) {
        if (!serviceOrderId) {
          setError("Chưa xác định được đơn dịch vụ cần xử lý.");
          return;
        }
        const response = await api.get(`/my/service-orders/${serviceOrderId}`);
        const detail = (response.data?.data ?? null) as ServiceOrderDetail | null;
        setOrder(detail);
        setSelectedServiceDate(
          detail?.requestedDate ||
            (directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
              ? directive.requestedDate || directive.scheduledDate || ""
              : ""),
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
  }, [directive, serviceOrderId]);

  useEffect(() => {
    setNotice("");
    setError("");
    void load();
  }, [load]);

  useEffect(() => {
    if (
      directive.type !== "SHOW_INLINE_SERVICE_PAYMENT" ||
      !order?.id ||
      !order.paymentStatus ||
      order.paymentStatus === "unpaid" ||
      autoAdvancedOrderRef.current === order.id
    ) {
      return;
    }
    autoAdvancedOrderRef.current = order.id;
    const timer = window.setTimeout(() => {
      onDirectiveChange?.({
        type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
        orderId: order.id,
        requestedDate: order.requestedDate ?? undefined,
        scheduledDate: order.scheduledDate ?? undefined,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [directive.type, onDirectiveChange, order]);

  const selectedDate = useMemo(() => {
    if (directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR") {
      return (
        selectedServiceDate || directive.requestedDate || directive.scheduledDate
      );
    }
    if (directive.type === "OPEN_APPOINTMENT_CALENDAR") {
      return directive.appointmentDate;
    }
    if (directive.type === "OPEN_REMINDER_CALENDAR") {
      return directive.reminderDate;
    }
    return undefined;
  }, [directive, selectedServiceDate]);

  async function reportPayment() {
    if (
      directive.type !== "SHOW_INLINE_SERVICE_PAYMENT" ||
      !serviceOrderId ||
      paying
    ) {
      return;
    }
    setPaying(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/service-orders/${serviceOrderId}/pay`);
      const detail = (response.data?.data ?? order) as ServiceOrderDetail;
      setOrder(detail);
      const returnedDirective = response.data?.uiDirective as
        | ScheduleDirective
        | undefined;
      onDirectiveChange?.(
        returnedDirective?.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
          ? returnedDirective
          : {
              type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
              orderId: serviceOrderId,
              requestedDate: detail?.requestedDate ?? undefined,
              scheduledDate: detail?.scheduledDate ?? undefined,
            },
      );
    } catch (paymentError) {
      setError(
        describeError(
          paymentError,
          "Chưa thể ghi nhận thanh toán. Vui lòng thử lại.",
        ),
      );
    } finally {
      setPaying(false);
    }
  }

  async function saveServiceDate() {
    if (
      directive.type !== "OPEN_SERVICE_SCHEDULE_CALENDAR" ||
      !selectedServiceDate ||
      saving
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(
        `/service-orders/${directive.orderId}/requested-date`,
        { requestedDate: selectedServiceDate },
      );
      setOrder((response.data?.data ?? order) as ServiceOrderDetail);
      setNotice(
        `Đã chốt ngày ${new Date(`${selectedServiceDate}T00:00:00`).toLocaleDateString("vi-VN")} cho dịch vụ. Bạn có thể xem lại trong lịch dịch vụ của tài khoản.`,
      );
    } catch (saveError) {
      setError(
        describeError(
          saveError,
          "Chưa thể lưu ngày thực hiện. Vui lòng thử lại.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const title =
    directive.type === "SHOW_INLINE_SERVICE_PAYMENT"
      ? "Dịch vụ đã đặt & thanh toán"
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

  const paymentStatus = order?.paymentStatus ??
    (directive.type === "SHOW_INLINE_SERVICE_PAYMENT"
      ? directive.paymentStatus
      : undefined) ??
    "unpaid";
  const paymentCode =
    order?.paymentCode ||
    (serviceOrderId ? `VPV${String(serviceOrderId).padStart(5, "0")}` : "VPV");

  return (
    <aside className="agent-workflow-panel" aria-label={title}>
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
        <div className="agent-workflow-content">
          <ServiceProgress stage="payment" />
          {order && (
            <section className="agent-workflow-order-summary is-payment-summary">
              <small>Đơn dịch vụ #{order.id}</small>
              <h3>{order.serviceName || "Dịch vụ chăm sóc"}</h3>
              <div><span>Lô áp dụng</span><strong>{order.plotCode || "—"}</strong></div>
              <div><span>Ngày mong muốn</span><strong>{order.requestedDate || "—"}</strong></div>
              <div><span>Chi phí</span><strong>{formatMoney(order.amount ?? directive.amount)}</strong></div>
            </section>
          )}

          <section className="agent-workflow-payment-box">
            <div className="agent-workflow-payment-title">
              <span><CreditCard size={15} /></span>
              <div>
                <small>Bước thanh toán</small>
                <strong>Chuyển khoản minh họa</strong>
              </div>
            </div>
            <div className="agent-workflow-payment-row">
              <span>Ngân hàng</span>
              <strong>VPV BANK</strong>
            </div>
            <div className="agent-workflow-payment-row">
              <span>Số tài khoản</span>
              <strong>0000 1234 5678</strong>
            </div>
            <div className="agent-workflow-payment-row">
              <span>Nội dung</span>
              <strong className="is-code">{paymentCode}</strong>
            </div>
            <div className="agent-workflow-payment-row is-total">
              <span>Số tiền</span>
              <strong>{formatMoney(order?.amount ?? directive.amount)}</strong>
            </div>
          </section>

          {paymentStatus === "unpaid" ? (
            <>
              <p className="agent-workflow-calendar-note">
                Sau khi bạn bấm xác nhận đã thanh toán, trợ lý sẽ tự chuyển panel này sang lịch để bạn kiểm tra và chốt ngày thực hiện dịch vụ.
              </p>
              <button
                type="button"
                className="agent-workflow-primary"
                onClick={() => void reportPayment()}
                disabled={!serviceOrderId || paying}
              >
                {paying ? <LoaderCircle size={15} className="spin" /> : <CreditCard size={15} />}
                {paying ? "Đang ghi nhận…" : "Tôi đã thanh toán"}
              </button>
            </>
          ) : (
            <div className="agent-workflow-payment-detected">
              <CheckCircle2 size={18} />
              <div>
                <strong>
                  {paymentStatus === "paid"
                    ? "Thanh toán đã được xác nhận"
                    : "Đã nhận tín hiệu thanh toán"}
                </strong>
                <span>Đang chuyển sang lịch thực hiện dịch vụ…</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="agent-workflow-link"
            onClick={() => navigate(ROUTES.SERVICES)}
          >
            Xem đơn dịch vụ của tôi
          </button>
        </div>
      ) : directive.type === "OPEN_SERVICE_SCHEDULE_CALENDAR" ? (
        <div className="agent-workflow-content">
          <ServiceProgress stage="calendar" />
          {order && (
            <section className="agent-workflow-order-summary">
              <small>Đơn dịch vụ #{order.id}</small>
              <h3>{order.serviceName || "Dịch vụ chăm sóc"}</h3>
              <div><span>Lô áp dụng</span><strong>{order.plotCode || "—"}</strong></div>
              <div><span>Chi phí</span><strong>{formatMoney(order.amount)}</strong></div>
              <div>
                <span>Thanh toán</span>
                <strong>
                  {order.paymentStatus === "paid" ? "Đã xác nhận" : "Đã ghi nhận"}
                </strong>
              </div>
            </section>
          )}
          <div>
            <p className="agent-workflow-section-title">Chọn ngày thực hiện</p>
            <CalendarPreview
              date={selectedDate}
              interactive
              onSelect={setSelectedServiceDate}
            />
            <p className="agent-workflow-calendar-note">
              Ngày bạn đã nói với trợ lý trước đó được tô sáng sẵn. Bạn có thể giữ nguyên hoặc chọn lại ngày khác trước khi chốt.
            </p>
          </div>
          <button
            type="button"
            className="agent-workflow-primary"
            onClick={() => void saveServiceDate()}
            disabled={!selectedServiceDate || saving}
          >
            {saving ? "Đang lưu…" : "Xác nhận ngày thực hiện"}
          </button>
          <button
            type="button"
            className="agent-workflow-link"
            onClick={() => navigate(ROUTES.SERVICES)}
          >
            Xem lịch & đơn dịch vụ của tôi
          </button>
        </div>
      ) : (
        <div className="agent-workflow-content">
          <CalendarPreview date={selectedDate} />
          <section className="agent-workflow-schedule">
            <div><span>Tổng lịch</span><strong>{entries.length}</strong></div>
            {entries.slice(0, 4).map((entry) => (
              <article
                key={entry.id}
                className={
                  entry.id ===
                  (directive.type === "OPEN_APPOINTMENT_CALENDAR"
                    ? directive.appointmentId
                    : directive.reminderId)
                    ? "is-current"
                    : ""
                }
              >
                <strong>
                  {entry.title ||
                    (directive.type === "OPEN_APPOINTMENT_CALENDAR"
                      ? "Hẹn với ban quản lý"
                      : "Lịch tưởng niệm")}
                </strong>
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
                    {entry.endTime ? `–${entry.endTime.slice(0, 5)}` : ""} · {entry.status || "đang chờ"}
                  </small>
                )}
              </article>
            ))}
          </section>
          <button
            type="button"
            className="agent-workflow-primary"
            onClick={() =>
              navigate(
                directive.type === "OPEN_APPOINTMENT_CALENDAR"
                  ? ROUTES.APPOINTMENTS
                  : ROUTES.REMINDERS,
              )
            }
          >
            Xem lịch đầy đủ
          </button>
        </div>
      )}
    </aside>
  );
}
