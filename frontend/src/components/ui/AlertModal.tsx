// src/components/ui/AlertModal.tsx
// Popup thông báo QUAN TRỌNG, hiện ở giữa màn hình, có nền che (backdrop) và
// CHỈ đóng lại khi người dùng bấm nút xác nhận — khác với Toast (góc màn
// hình, tự biến mất sau vài giây, dùng cho thông báo phụ/không cần xác nhận).
//
// Dùng khi: cần người dùng đọc và chủ động xác nhận đã hiểu trước khi tiếp
// tục thao tác (vd: bị chuyển hướng vì hồ sơ chưa đầy đủ, cảnh báo trước khi
// xoá dữ liệu, v.v.). Không tự đóng theo thời gian và không đóng khi bấm ra
// ngoài, để đảm bảo thông tin quan trọng không bị bỏ lỡ.
//
// Lưu ý: cố tình dùng mã màu hex cứng thay vì biến CSS của theme — vì modal
// này có thể được gọi từ bất kỳ trang nào (mỗi trang có thể tự định nghĩa lại
// biến CSS riêng của nó), nên hardcode để đảm bảo màu sắc/độ tương phản luôn
// đúng như thiết kế, không bị ăn nhầm biến của trang cha.
import type { ReactNode } from "react";

interface AlertModalProps {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  variant?: "info" | "warning" | "danger";
  onConfirm: () => void;
}

const VARIANT_STYLE: Record<
  NonNullable<AlertModalProps["variant"]>,
  { icon: string; accent: string; accentSoft: string; buttonBg: string }
> = {
  info: {
    icon: "ℹ️",
    accent: "#4A9EFF",
    accentSoft: "rgba(74,158,255,0.16)",
    buttonBg: "#4A9EFF",
  },
  // Đổi từ vàng cam sang xanh teal, khớp với nút "Lưu thay đổi" trong trang Hồ sơ.
  warning: {
    icon: "⚠️",
    accent: "#00E5C4",
    accentSoft: "rgba(0,229,196,0.16)",
    buttonBg: "linear-gradient(135deg, #00E5C4, #00B89E)",
  },
  danger: {
    icon: "⛔",
    accent: "#FF5C5C",
    accentSoft: "rgba(255,92,92,0.16)",
    buttonBg: "#FF5C5C",
  },
};

export default function AlertModal({
  open,
  title = "Thông báo",
  message,
  confirmLabel = "Xác nhận",
  variant = "warning",
  onConfirm,
}: AlertModalProps) {
  if (!open) return null;
  const meta = VARIANT_STYLE[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 5, 12, 0.86)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#0F1E33",
          border: `1.5px solid ${meta.accent}`,
          borderRadius: 14,
          padding: "30px 28px",
          boxShadow: `0 8px 48px rgba(0,0,0,0.55), 0 0 0 4px ${meta.accentSoft}`,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: meta.accentSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </span>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            {title}
          </h2>
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "#C7D6E8",
            marginBottom: 26,
          }}
        >
          {message}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 8,
            border: "none",
            background: meta.buttonBg,
            color: "#04101C",
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.02em",
            fontFamily: "'Inter', sans-serif",
            cursor: "pointer",
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
