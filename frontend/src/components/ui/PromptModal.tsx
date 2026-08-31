// src/components/ui/PromptModal.tsx
// Popup xin nhập một dòng lý do/ghi chú, hiện ở giữa màn hình, có nền che
// (backdrop) — thay thế cho window.prompt() mặc định của trình duyệt (khung
// popup xám, không theo giao diện web, không tuỳ biến được). Dùng chung một
// kiểu khung/màu với AlertModal (đúng component đang dùng bên trang Hồ sơ
// của khách hàng) để mọi popup trên web (cả customer lẫn admin) đồng bộ.
//
// Dùng khi: cần người dùng nhập một đoạn văn bản ngắn (lý do từ chối, lý do
// yêu cầu xoá, v.v.) trước khi xác nhận một thao tác — không dùng cho các
// xác nhận đơn giản chỉ cần Đồng ý/Huỷ (dùng AlertModal/useConfirmDialog cho
// trường hợp đó).
import { useEffect, useState } from "react";

interface PromptModalProps {
  open: boolean;
  title?: string;
  message?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "info" | "warning" | "danger";
  // Nếu true, không cho bấm nút xác nhận khi ô nhập còn trống.
  required?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const VARIANT_STYLE: Record<
  NonNullable<PromptModalProps["variant"]>,
  { icon: string; accent: string; accentSoft: string; buttonBg: string }
> = {
  info: {
    icon: "ℹ️",
    accent: "#4A9EFF",
    accentSoft: "rgba(74,158,255,0.16)",
    buttonBg: "#4A9EFF",
  },
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

export default function PromptModal({
  open,
  title = "Nhập thông tin",
  message,
  placeholder,
  defaultValue = "",
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  variant = "warning",
  required = false,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  // Reset lại nội dung ô nhập mỗi lần popup được mở lại.
  useEffect(() => {
    if (open) setValue(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const meta = VARIANT_STYLE[variant];
  const disabled = required && !value.trim();

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

        {message && (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "#C7D6E8",
              marginBottom: 14,
            }}
          >
            {message}
          </div>
        )}

        <textarea
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 76,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1.5px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.04)",
            color: "#FFFFFF",
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            marginBottom: 22,
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "13px",
              borderRadius: 8,
              border: "1.5px solid rgba(255,255,255,0.16)",
              background: "transparent",
              color: "#C7D6E8",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.02em",
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => !disabled && onConfirm(value.trim())}
            disabled={disabled}
            style={{
              flex: 1,
              padding: "13px",
              borderRadius: 8,
              border: "none",
              background: meta.buttonBg,
              color: "#04101C",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "0.02em",
              fontFamily: "'Inter', sans-serif",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
