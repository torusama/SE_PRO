// src/hooks/usePromptDialog.tsx
//
// Thay thế cho window.prompt() mặc định của trình duyệt (khung popup xám,
// không theo giao diện web). Dùng chung PromptModal — cùng kiểu khung/màu
// với AlertModal đang dùng bên trang Hồ sơ của khách hàng — để mọi popup
// nhập lý do trên web (cả customer lẫn admin) đều đồng bộ giao diện.
//
// Cách dùng:
//   const { promptFor, dialog } = usePromptDialog();
//   ...
//   const reason = await promptFor({ title: "...", message: "..." });
//   if (reason === null) return; // người dùng bấm Huỷ
//   ...
//   return <>{dialog}{/* phần còn lại của trang */}</>;
import { useCallback, useMemo, useRef, useState } from "react";
import PromptModal from "@/components/ui/PromptModal";

interface PromptOptions {
  title?: string;
  message?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "info" | "warning" | "danger";
  required?: boolean;
}

export function usePromptDialog() {
  const [state, setState] = useState<PromptOptions | null>(null);
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const promptFor = useCallback((options: PromptOptions) => {
    setState(options);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  }, []);

  const dialog = useMemo(
    () => (
      <PromptModal
        open={state !== null}
        title={state?.title ?? "Nhập thông tin"}
        message={state?.message}
        placeholder={state?.placeholder}
        defaultValue={state?.defaultValue ?? ""}
        confirmLabel={state?.confirmLabel ?? "Xác nhận"}
        cancelLabel={state?.cancelLabel ?? "Huỷ"}
        variant={state?.variant ?? "warning"}
        required={state?.required ?? false}
        onConfirm={(value) => settle(value)}
        onCancel={() => settle(null)}
      />
    ),
    [state, settle],
  );

  return { promptFor, dialog };
}

export default usePromptDialog;
