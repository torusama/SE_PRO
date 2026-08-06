import { ROUTES } from "@/constants/routes";

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  request_submitted: "Yêu cầu mới",
  request_approved: "Yêu cầu đã duyệt",
  request_rejected: "Yêu cầu bị từ chối",
  request_cancelled: "Yêu cầu đã hủy",
  appointment_created: "Lịch hẹn cần xác nhận",
  appointment_updated: "Lịch hẹn đã cập nhật",
  appointment_response: "Phản hồi lịch hẹn",
  appointment_status_updated: "Trạng thái lịch hẹn",
  contract_created: "Hợp đồng mới",
  contract_updated: "Cập nhật hợp đồng",
  service_submitted: "Dịch vụ mới",
  service_pending_confirm: "Chờ xác nhận dịch vụ",
  service_confirmed: "Dịch vụ đã xác nhận",
  service_in_progress: "Dịch vụ đang thực hiện",
  service_completed: "Dịch vụ hoàn tất",
  service_cancelled: "Dịch vụ đã hủy",
  transfer_submitted: "Yêu cầu chuyển nhượng",
  transfer_approved: "Chuyển nhượng đã duyệt",
  transfer_rejected: "Chuyển nhượng bị từ chối",
  memorial_reminder: "Nhắc lịch tưởng niệm",
  system_update: "Cập nhật hệ thống",
  announcement: "Thông báo chung",
};

export function notificationTypeLabel(type: string) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];

  return (
    type
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ") || "Thông báo"
  );
}

export function notificationTargetRoute(item: NotificationItem) {
  if (item.type === "appointment_response") {
    return `${ROUTES.ADMIN_REQUESTS}?appointment=${item.relatedEntityId ?? ""}`;
  }

  switch (item.relatedEntityType) {
    case "offline_appointment":
      return `${ROUTES.MY_LOTS}?appointment=${item.relatedEntityId ?? ""}#requests`;
    case "reservation_request":
      return `${ROUTES.MY_LOTS}#requests`;
    case "contract":
      return `${ROUTES.MY_LOTS}#contracts`;
    case "service_order":
      return `${ROUTES.SERVICES}?tab=track${item.relatedEntityId ? `&order=${item.relatedEntityId}` : ""}`;
    case "reminder":
      return ROUTES.REMINDERS;
    default:
      return null;
  }
}

export function formatNotificationTime(value: string) {
  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
