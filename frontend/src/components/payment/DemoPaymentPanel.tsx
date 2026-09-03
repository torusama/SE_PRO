import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  Copy,
  Landmark,
  QrCode,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import "./DemoPaymentPanel.css";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1)
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}

/** QR demo: giữ hành vi cũ, chỉ thay layout hiển thị. */
function FakeQrCode({ seed }: { seed: string }) {
  const grid = 21;
  const cell = 8;
  const size = grid * cell;
  const rand = useMemo(() => mulberry32(hashString(seed)), [seed]);

  const modules = useMemo(() => {
    const cells: boolean[][] = Array.from({ length: grid }, () =>
      Array(grid).fill(false),
    );
    for (let y = 0; y < grid; y += 1) {
      for (let x = 0; x < grid; x += 1) cells[y][x] = rand() > 0.55;
    }
    function drawFinder(ox: number, oy: number) {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const border = x === 0 || x === 6 || y === 0 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          cells[oy + y][ox + x] = border || core;
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(grid - 7, 0);
    drawFinder(0, grid - 7);
    return cells;
  }, [rand]);

  return (
    <svg
      className="fake-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Mã QR minh hoạ, không dùng để quét thanh toán thật"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill="#081320"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function describeError(err: unknown, action: string): string {
  const axiosErr = err as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  if (!axiosErr?.response) {
    return `Không kết nối được tới máy chủ để ${action} (${axiosErr?.code || axiosErr?.message || "lỗi mạng"}). Kiểm tra backend có đang chạy và địa chỉ API (VITE_API_URL) có đúng không.`;
  }
  const status = axiosErr.response.status;
  const backendMessage = axiosErr.response.data?.message;
  if (backendMessage) return `${backendMessage} (mã lỗi ${status})`;
  return `Máy chủ trả về lỗi ${status} khi ${action}. Vui lòng xem log backend để biết chi tiết.`;
}

export type PaymentStatus = "unpaid" | "awaiting_confirmation" | "paid";

interface DemoPaymentPanelProps {
  orderId: number;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentCode?: string | null;
  paidAt?: string | null;
  paymentConfirmedAt?: string | null;
  variant: "customer" | "admin";
  onChanged?: () => void | Promise<void>;
}

export default function DemoPaymentPanel({
  orderId,
  amount,
  paymentStatus,
  paymentCode,
  paidAt,
  paymentConfirmedAt,
  variant,
  onChanged,
}: DemoPaymentPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = paymentCode || `VPV${String(orderId).padStart(5, "0")}`;

  useEffect(() => {
    if (!isQrOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setIsQrOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isQrOpen, submitting]);

  async function copyPaymentCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function handleMarkPaid() {
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/service-orders/${orderId}/pay`);
    } catch (err) {
      setError(describeError(err, "ghi nhận thanh toán"));
      setSubmitting(false);
      return;
    }
    try {
      await onChanged?.();
    } catch (err) {
      console.error(
        "Thanh toán đã ghi nhận nhưng tải lại dữ liệu thất bại:",
        err,
      );
    } finally {
      setSubmitting(false);
      setIsQrOpen(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/admin/service-orders/${orderId}/confirm-payment`);
    } catch (err) {
      setError(describeError(err, "xác nhận thanh toán"));
      setSubmitting(false);
      return;
    }
    try {
      await onChanged?.();
    } catch (err) {
      console.error(
        "Xác nhận thanh toán thành công nhưng tải lại dữ liệu thất bại:",
        err,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (variant === "admin") {
    return (
      <section className="demo-payment demo-payment--admin">
        <div className="demo-payment-heading">
          <span className="demo-payment-icon">
            <WalletCards aria-hidden="true" />
          </span>
          <div>
            <span className="demo-payment-kicker">Giao dịch dịch vụ</span>
            <h3>Thanh toán</h3>
          </div>
        </div>
        {error && (
          <div className="demo-payment-status demo-payment-status--waiting">
            {error}
          </div>
        )}
        {paymentStatus === "unpaid" && (
          <>
            <div className="demo-payment-status demo-payment-status--waiting">
              Khách hàng chưa báo thanh toán · Mã <strong>{code}</strong> ·{" "}
              <strong>{money.format(amount)}</strong>
            </div>
            <p className="demo-payment-hint">
              Đây là luồng demo: có thể xác nhận ngay để mô phỏng đã nhận tiền,
              không cần chờ khách hàng thao tác trước.
            </p>
            <button
              className="payment-primary"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting
                ? "Đang xác nhận…"
                : "Xác nhận đã nhận thanh toán (demo)"}
            </button>
          </>
        )}
        {paymentStatus === "awaiting_confirmation" && (
          <>
            <div className="demo-payment-status demo-payment-status--paid">
              Khách hàng báo đã thanh toán lúc{" "}
              {paidAt ? new Date(paidAt).toLocaleString("vi-VN") : "—"} · Mã{" "}
              <strong>{code}</strong> · <strong>{money.format(amount)}</strong>
            </div>
            <p className="demo-payment-hint">
              Chỉ xác nhận sau khi đã đối soát tiền trong tài khoản ngân hàng.
            </p>
            <button
              className="payment-primary"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? "Đang xác nhận…" : "Xác nhận đã nhận thanh toán"}
            </button>
          </>
        )}
        {paymentStatus === "paid" && (
          <div className="demo-payment-status demo-payment-status--confirmed">
            <CheckCircle2 aria-hidden="true" />
            <span>
              Đã xác nhận thanh toán lúc{" "}
              {paymentConfirmedAt
                ? new Date(paymentConfirmedAt).toLocaleString("vi-VN")
                : "—"}
              .
            </span>
          </div>
        )}
      </section>
    );
  }

  if (paymentStatus === "paid") {
    return (
      <section className="demo-payment demo-payment--customer demo-payment--settled">
        <div className="demo-payment-heading">
          <span className="demo-payment-icon success">
            <CheckCircle2 aria-hidden="true" />
          </span>
          <div>
            <span className="demo-payment-kicker">Thanh toán hoàn tất</span>
            <h3>Đơn đang được thực hiện</h3>
          </div>
        </div>
        <div className="demo-payment-status demo-payment-status--confirmed">
          <Check aria-hidden="true" />
          <span>
            Khoản thanh toán đã được xác nhận. Bạn có thể tiếp tục theo dõi lịch
            thực hiện bên dưới.
          </span>
        </div>
      </section>
    );
  }

  if (paymentStatus === "awaiting_confirmation") {
    return (
      <section className="demo-payment demo-payment--customer demo-payment--reported">
        <div className="demo-payment-heading">
          <span className="demo-payment-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <span className="demo-payment-kicker">Đã báo thanh toán</span>
            <h3>Đang chờ ban quản lý đối soát</h3>
          </div>
        </div>
        <div className="demo-payment-status demo-payment-status--paid">
          Hệ thống đã ghi nhận thông báo thanh toán. Bạn không cần thao tác lại
          trong lúc chờ xác nhận.
        </div>
      </section>
    );
  }

  const modal = isQrOpen ? (
    <div
      className="payment-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting)
          setIsQrOpen(false);
      }}
    >
      <section
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`payment-modal-title-${orderId}`}
        aria-describedby={`payment-modal-desc-${orderId}`}
      >
        <button
          className="payment-modal-close"
          type="button"
          aria-label="Đóng cửa sổ thanh toán"
          onClick={() => setIsQrOpen(false)}
          disabled={submitting}
        >
          <X aria-hidden="true" />
        </button>

        <div className="payment-modal-heading">
          <span className="payment-modal-icon">
            <QrCode aria-hidden="true" />
          </span>
          <div>
            <span>Thanh toán dịch vụ</span>
            <h2 id={`payment-modal-title-${orderId}`}>
              Quét mã QR để chuyển khoản
            </h2>
            <p id={`payment-modal-desc-${orderId}`}>
              Kiểm tra đúng số tiền và nội dung chuyển khoản trước khi xác nhận.
            </p>
          </div>
        </div>

        {error && (
          <div className="demo-payment-status demo-payment-status--waiting payment-modal-error">
            {error}
          </div>
        )}

        <div className="payment-modal-content">
          <div className="payment-qr-stage">
            <div className="payment-qr-frame">
              <FakeQrCode seed={code} />
            </div>
            <span>Mã QR minh hoạ</span>
          </div>

          <div className="payment-transfer-card">
            <div className="payment-transfer-bank">
              <span className="payment-transfer-bank-icon">
                <Landmark aria-hidden="true" />
              </span>
              <div>
                <small>Ngân hàng thụ hưởng</small>
                <strong>VPV BANK</strong>
              </div>
            </div>
            <dl className="payment-transfer-list">
              <div>
                <dt>Số tài khoản</dt>
                <dd>0000 1234 5678</dd>
              </div>
              <div>
                <dt>Chủ tài khoản</dt>
                <dd>VINH PHUC VIEN</dd>
              </div>
              <div className="payment-transfer-amount">
                <dt>Số tiền</dt>
                <dd>{money.format(amount)}</dd>
              </div>
              <div>
                <dt>Nội dung chuyển khoản</dt>
                <dd className="payment-code-line">
                  <span>{code}</span>
                  <button
                    type="button"
                    onClick={() => void copyPaymentCode()}
                    aria-label="Sao chép nội dung chuyển khoản"
                  >
                    {copied ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                    {copied ? "Đã chép" : "Sao chép"}
                  </button>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="payment-security-note">
          <ShieldCheck aria-hidden="true" />
          <span>
            Chỉ bấm “Tôi đã thanh toán” sau khi giao dịch ngân hàng đã hoàn tất.
          </span>
        </div>
        <div className="payment-modal-actions">
          <button
            type="button"
            className="payment-secondary"
            onClick={() => setIsQrOpen(false)}
            disabled={submitting}
          >
            Để sau
          </button>
          <button
            type="button"
            className="payment-primary"
            onClick={() => void handleMarkPaid()}
            disabled={submitting}
          >
            {submitting ? "Đang ghi nhận…" : "Tôi đã thanh toán"}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <section className="demo-payment demo-payment--customer demo-payment--unpaid">
        <div className="demo-payment-toolbar">
          <div className="demo-payment-heading">
            <span className="demo-payment-icon">
              <WalletCards aria-hidden="true" />
            </span>
            <div>
              <span className="demo-payment-kicker">Bước tiếp theo</span>
              <h3>Thanh toán dịch vụ</h3>
            </div>
          </div>
          <button
            className="payment-primary payment-open-qr"
            type="button"
            onClick={() => setIsQrOpen(true)}
          >
            <QrCode aria-hidden="true" /> Thanh toán bằng QR
          </button>
        </div>
        {error && (
          <div className="demo-payment-status demo-payment-status--waiting">
            {error}
          </div>
        )}
        <div className="payment-summary-row">
          <div>
            <span>Số tiền cần thanh toán</span>
            <strong>{money.format(amount)}</strong>
          </div>
          <div>
            <span>Mã giao dịch</span>
            <strong>{code}</strong>
          </div>
        </div>
      </section>
      {modal && typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
