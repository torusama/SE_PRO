import { CalendarDays, CheckCircle2, CreditCard, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AgentResponse } from "./agent.types";
import "./InlineServicePaymentCard.css";

type PaymentDirective = Extract<
  NonNullable<AgentResponse["uiDirective"]>,
  { type: "SHOW_INLINE_SERVICE_PAYMENT" }
>;

type ScheduleDirective = Extract<
  NonNullable<AgentResponse["uiDirective"]>,
  { type: "OPEN_SERVICE_SCHEDULE_CALENDAR" }
>;

interface ServiceOrderDetail {
  id: number;
  serviceName?: string;
  plotCode?: string;
  requestedDate?: string | null;
  amount?: number | string;
  paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
  paymentCode?: string | null;
}

interface Props {
  directive: PaymentDirective;
  onPaymentRecorded: (directive: ScheduleDirective) => void;
}

function money(value: number | string | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("vi-VN")} VND`
    : "—";
}

function describeError(error: unknown) {
  const requestError = error as {
    response?: { data?: { message?: string } };
  };
  return (
    requestError.response?.data?.message ??
    "Chưa thể ghi nhận thanh toán. Vui lòng thử lại."
  );
}

export default function InlineServicePaymentCard({
  directive,
  onPaymentRecorded,
}: Props) {
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    if (!directive.orderId) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/my/service-orders/${directive.orderId}`);
      setOrder((response.data?.data ?? null) as ServiceOrderDetail | null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [directive.orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const orderId = order?.id ?? directive.orderId;
  const amount = order?.amount ?? directive.amount;
  const paymentStatus =
    order?.paymentStatus ?? directive.paymentStatus ?? "unpaid";
  const paymentCode = useMemo(
    () => order?.paymentCode || (orderId ? `VPV${String(orderId).padStart(5, "0")}` : "VPV"),
    [order?.paymentCode, orderId],
  );

  async function reportPayment() {
    if (!orderId || paying) return;
    setPaying(true);
    setError("");
    try {
      const response = await api.post(`/service-orders/${orderId}/pay`);
      const returnedDirective = response.data?.uiDirective as
        | ScheduleDirective
        | undefined;
      await loadOrder();
      onPaymentRecorded(
        returnedDirective?.type === "OPEN_SERVICE_SCHEDULE_CALENDAR"
          ? returnedDirective
          : { type: "OPEN_SERVICE_SCHEDULE_CALENDAR", orderId },
      );
    } catch (paymentError) {
      setError(describeError(paymentError));
    } finally {
      setPaying(false);
    }
  }

  return (
    <section className="agent-inline-payment" aria-label="Thanh toán đơn dịch vụ">
      <header>
        <span className="agent-inline-payment-icon"><CreditCard size={17} /></span>
        <div>
          <small>Đơn dịch vụ {orderId ? `#${orderId}` : ""}</small>
          <strong>{order?.serviceName || "Thanh toán dịch vụ"}</strong>
        </div>
        <b>{money(amount)}</b>
      </header>

      {loading && !order ? (
        <div className="agent-inline-payment-loading">
          <LoaderCircle size={15} className="spin" /> Đang tải thông tin đơn…
        </div>
      ) : (
        <>
          <div className="agent-inline-payment-summary">
            <div><span>Lô áp dụng</span><strong>{order?.plotCode || "—"}</strong></div>
            <div><span>Nội dung chuyển khoản</span><strong>{paymentCode}</strong></div>
            <div><span>Ngân hàng minh họa</span><strong>VPV BANK · 0000 1234 5678</strong></div>
          </div>

          {paymentStatus === "unpaid" ? (
            <div className="agent-inline-payment-action">
              <p>
                Sau khi bạn xác nhận đã thanh toán, hệ thống mới mở lịch bên phải để chọn ngày thực hiện dịch vụ.
              </p>
              <button type="button" onClick={() => void reportPayment()} disabled={!orderId || paying}>
                {paying ? <LoaderCircle size={15} className="spin" /> : <CreditCard size={15} />}
                {paying ? "Đang ghi nhận…" : "Tôi đã thanh toán"}
              </button>
            </div>
          ) : (
            <div className="agent-inline-payment-paid">
              <CheckCircle2 size={16} />
              <div>
                <strong>
                  {paymentStatus === "paid" ? "Thanh toán đã được xác nhận" : "Đã ghi nhận thanh toán"}
                </strong>
                <span>
                  {paymentStatus === "paid"
                    ? "Đơn đang được xử lý."
                    : "Đang chờ ban quản lý xác nhận. Bạn có thể chọn ngày thực hiện trên lịch."}
                </span>
              </div>
              {orderId && (
                <button
                  type="button"
                  onClick={() =>
                    onPaymentRecorded({
                      type: "OPEN_SERVICE_SCHEDULE_CALENDAR",
                      orderId,
                      requestedDate: order?.requestedDate ?? undefined,
                    })
                  }
                >
                  <CalendarDays size={14} /> Mở lịch
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="agent-inline-payment-error">{error}</p>}
    </section>
  );
}
