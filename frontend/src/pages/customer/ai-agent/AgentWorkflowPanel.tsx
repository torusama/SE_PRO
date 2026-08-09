import { CalendarDays, CreditCard, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import type { AgentResponse, AgentService } from "./agent.types";
import "./AgentWorkflowPanel.css";

type Directive = NonNullable<AgentResponse["uiDirective"]>;

interface Props {
  directive: Directive;
  services: AgentService[];
  busy: boolean;
  onClose: () => void;
  onStartServiceOrder: (service: AgentService) => void;
}

interface ServiceOrderDetail {
  id: number;
  serviceName?: string;
  plotCode?: string;
  requestedDate?: string;
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

function CalendarPreview({ date }: { date?: string }) {
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date();
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: offset + days }, (_, index) =>
    index < offset ? null : index - offset + 1,
  );
  return (
    <div className="agent-workflow-calendar">
      <strong>Tháng {month + 1}/{year}</strong>
      <div className="agent-workflow-weekdays">
        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="agent-workflow-days">
        {cells.map((day, index) => (
          <span
            key={`${day ?? "empty"}-${index}`}
            className={day === selected.getDate() ? "is-selected" : ""}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AgentWorkflowPanel({
  directive,
  services,
  busy,
  onClose,
  onStartServiceOrder,
}: Props) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (directive.type === "OPEN_SERVICE_PANEL" && directive.orderId) {
        const response = await api.get(`/my/service-orders/${directive.orderId}`);
        setOrder(response.data?.data ?? null);
      } else if (directive.type === "OPEN_APPOINTMENT_CALENDAR") {
        const response = await api.get("/schedule/appointments/me");
        setEntries(response.data?.data ?? []);
      } else if (directive.type === "OPEN_REMINDER_CALENDAR") {
        const response = await api.get("/my/reminders");
        setEntries(response.data?.data ?? []);
      }
    } catch {
      setError("Chưa thể tải dữ liệu mới nhất. Bạn có thể mở trang chi tiết để kiểm tra lại.");
    } finally {
      setLoading(false);
    }
  }, [directive]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDate = useMemo(() => {
    if (directive.type === "OPEN_APPOINTMENT_CALENDAR") return directive.appointmentDate;
    if (directive.type === "OPEN_REMINDER_CALENDAR") return directive.reminderDate;
    return order?.requestedDate;
  }, [directive, order]);

  async function reportPayment() {
    if (!order?.id) return;
    setLoading(true);
    setError("");
    try {
      await api.post(`/service-orders/${order.id}/pay`);
      await load();
    } catch {
      setError("Chưa thể ghi nhận thanh toán. Vui lòng thử lại hoặc kiểm tra đơn tại trang dịch vụ.");
      setLoading(false);
    }
  }

  const title =
    directive.type === "OPEN_SERVICE_PANEL"
      ? "Dịch vụ và thanh toán"
      : directive.type === "OPEN_APPOINTMENT_CALENDAR"
        ? "Lịch hẹn với ban quản lý"
        : "Lịch nhắc tưởng niệm";

  return (
    <aside className="agent-workflow-panel" aria-label={title}>
      <button className="agent-workflow-close" type="button" onClick={onClose} aria-label="Đóng bảng">
        <X size={18} />
      </button>
      <header>
        <span>{directive.type === "OPEN_SERVICE_PANEL" ? <CreditCard size={15} /> : <CalendarDays size={15} />}</span>
        <div>
          <small>Trợ lý đang hỗ trợ</small>
          <h2>{title}</h2>
        </div>
      </header>

      {error && <p className="agent-workflow-error">{error}</p>}
      {loading && <p className="agent-workflow-loading">Đang đồng bộ dữ liệu…</p>}

      {directive.type === "OPEN_SERVICE_PANEL" && (
        <div className="agent-workflow-content">
          {order ? (
            <section className="agent-workflow-order">
              <small>Đơn dịch vụ #{order.id}</small>
              <h3>{order.serviceName || "Dịch vụ chăm sóc"}</h3>
              <CalendarPreview date={order.requestedDate} />
              <dl>
                <div><dt>Lô áp dụng</dt><dd>{order.plotCode || "—"}</dd></div>
                <div><dt>Ngày thực hiện</dt><dd>{order.requestedDate || "—"}</dd></div>
                <div><dt>Chi phí</dt><dd>{formatMoney(order.amount)}</dd></div>
                <div><dt>Thanh toán</dt><dd>{order.paymentStatus === "paid" ? "Đã xác nhận" : order.paymentStatus === "awaiting_confirmation" ? "Chờ xác nhận" : "Chưa thanh toán"}</dd></div>
              </dl>
              {order.paymentStatus === "unpaid" && (
                <button type="button" className="agent-workflow-primary" onClick={() => void reportPayment()} disabled={loading}>
                  Tôi đã thanh toán
                </button>
              )}
            </section>
          ) : (
            <div className="agent-workflow-service-list">
              {services.map((service) => (
                <button key={service.id} type="button" onClick={() => onStartServiceOrder(service)} disabled={busy}>
                  <span><strong>{service.name}</strong><small>{service.description || "Dịch vụ đang nhận yêu cầu"}</small></span>
                  <b>{formatMoney(service.basePrice)}</b>
                </button>
              ))}
              {!services.length && <p>Chưa có danh sách dịch vụ trong phản hồi này.</p>}
            </div>
          )}
          <button type="button" className="agent-workflow-link" onClick={() => navigate(ROUTES.SERVICES)}>Mở trang dịch vụ</button>
        </div>
      )}

      {directive.type !== "OPEN_SERVICE_PANEL" && (
        <div className="agent-workflow-content">
          <CalendarPreview date={selectedDate} />
          <section className="agent-workflow-schedule">
            <div><span>Tổng lịch</span><strong>{entries.length}</strong></div>
            {entries.slice(0, 4).map((entry) => (
              <article key={entry.id} className={entry.id === (directive.type === "OPEN_APPOINTMENT_CALENDAR" ? directive.appointmentId : directive.reminderId) ? "is-current" : ""}>
                <strong>{entry.title || (directive.type === "OPEN_APPOINTMENT_CALENDAR" ? "Hẹn với ban quản lý" : "Lịch tưởng niệm")}</strong>
                <span>{entry.appointmentDate || entry.specificDate || (entry.remindDay && entry.remindMonth ? `${entry.remindDay}/${entry.remindMonth} hằng năm` : "Chưa xác định ngày")}</span>
                {entry.startTime && <small>{entry.startTime.slice(0, 5)}{entry.endTime ? `–${entry.endTime.slice(0, 5)}` : ""} · {entry.status || "đang chờ"}</small>}
              </article>
            ))}
          </section>
          <button
            type="button"
            className="agent-workflow-primary"
            onClick={() => navigate(directive.type === "OPEN_APPOINTMENT_CALENDAR" ? ROUTES.APPOINTMENTS : ROUTES.REMINDERS)}
          >
            Xem lịch đầy đủ
          </button>
        </div>
      )}
    </aside>
  );
}
