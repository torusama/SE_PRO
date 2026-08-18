// src/hooks/useConfirmDialog.tsx
//
// Thay thế cho window.confirm() mặc định của trình duyệt (khung popup xám,
// không theo giao diện web). Dùng chung AlertModal — đúng component đang
// dùng bên trang Hồ sơ của khách hàng — để mọi popup xác nhận trên web (cả
// customer lẫn admin) đều cùng một kiểu.
//
// Cách dùng:
//   const { confirm, dialog } = useConfirmDialog();
//   ...
//   if (!(await confirm({ message: "Duyệt yêu cầu này?" }))) return;
//   ...
//   return <>{dialog}{/* phần còn lại của trang */}</>;
import { useCallback, useMemo, useRef, useState } from "react";
import AlertModal from "@/components/ui/AlertModal";

interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "info" | "warning" | "danger";
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(null);
  }, []);

  const dialog = useMemo(
    () => (
      <AlertModal
        open={state !== null}
        title={state?.title ?? "Xác nhận"}
        message={state?.message ?? ""}
        confirmLabel={state?.confirmLabel ?? "Xác nhận"}
        cancelLabel={state?.cancelLabel ?? "Huỷ"}
        variant={state?.variant ?? "warning"}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ),
    [state, settle],
  );

  return { confirm, dialog };
}

export default useConfirmDialog;
