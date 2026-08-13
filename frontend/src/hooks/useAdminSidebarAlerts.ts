import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface NotificationRow {
  isRead: boolean;
}

interface PendingCounts {
  pendingRequests: number;
  pendingCancellations: number;
  pendingAppointments: number;
}

export interface AdminSidebarAlerts {
  notify: number;
  requests: number;
  appointments: number;
}

const EMPTY: AdminSidebarAlerts = { notify: 0, requests: 0, appointments: 0 };

/**
 * Powers the "cần xử lý ngay" red badges in the admin sidebar (Thông báo /
 * Xử lý yêu cầu / Phê duyệt lịch hẹn) so admins see new work the moment it
 * arrives, instead of only after opening each page.
 */
export function useAdminSidebarAlerts(): AdminSidebarAlerts {
  const [alerts, setAlerts] = useState<AdminSidebarAlerts>(EMPTY);
  const requestInFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);

  const load = useCallback(async () => {
    if (requestInFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    requestInFlightRef.current = true;

    try {
      do {
        pendingReloadRef.current = false;
        try {
          const [notificationsRes, pendingRes] = await Promise.all([
            api.get<ApiResponse<NotificationRow[]>>("/notifications"),
            api.get<ApiResponse<PendingCounts>>(
              "/admin/dashboard/pending-counts",
            ),
          ]);

          const unread = (notificationsRes.data.data ?? []).filter(
            (item) => !item.isRead,
          ).length;
          const counts = pendingRes.data.data;

          setAlerts({
            notify: unread,
            requests:
              (counts?.pendingRequests ?? 0) +
              (counts?.pendingCancellations ?? 0),
            appointments: counts?.pendingAppointments ?? 0,
          });
        } catch {
          // The sidebar badge is best-effort; a later realtime event or
          // reconnect retries, so a failed poll shouldn't surface an error.
        }
      } while (pendingReloadRef.current);
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useRealtimeRefresh(
    ["notifications", "reservations", "appointments", "dashboard"],
    load,
  );

  return alerts;
}
