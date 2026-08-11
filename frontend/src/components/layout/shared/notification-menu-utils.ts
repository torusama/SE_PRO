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
  request_cancelled_by_customer: "Khách hàng đã hủy yêu cầu",
  request_cancellation_submitted: "Yêu cầu hủy mới",
  request_cancellation_approved: "Yêu cầu hủy đã được duyệt",
  request_cancellation_rejected: "Yêu cầu hủy bị từ chối",
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

const REQUEST_CANCELLATION_TYPES = new Set([
  "request_cancelled",
  "request_cancelled_by_customer",
  "request_cancellation_submitted",
  "request_cancellation_approved",
  "request_cancellation_rejected",
]);

export function isRequestCancellationType(type: string) {
  return REQUEST_CANCELLATION_TYPES.has(type);
}

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

export function notificationTargetRoute(
  item: NotificationItem,
  audience: "customer" | "admin" = "customer",
) {
  if (isRequestCancellationType(item.type)) {
    const id = item.relatedEntityId;
    if (audience === "admin") {
      return id
        ? `${ROUTES.ADMIN_REQUESTS}?view=cancellations&request=${id}`
        : `${ROUTES.ADMIN_REQUESTS}?view=cancellations`;
    }
    return id
      ? `${ROUTES.MY_LOTS}?request=${id}#requests`
      : `${ROUTES.MY_LOTS}#requests`;
  }

  if (item.type === "appointment_response") {
    return `${ROUTES.ADMIN_REQUESTS}?appointment=${item.relatedEntityId ?? ""}`;
  }

  if (audience === "admin") {
    const id = item.relatedEntityId;

    switch (item.relatedEntityType) {
      case "offline_appointment":
        return id
          ? `${ROUTES.ADMIN_REQUESTS}?appointment=${id}`
          : ROUTES.ADMIN_REQUESTS;
      case "reservation_request":
        return id
          ? `${ROUTES.ADMIN_REQUESTS}?request=${id}`
          : ROUTES.ADMIN_REQUESTS;
      case "contract":
        return id
          ? `${ROUTES.ADMIN_CONTRACTS}?contractId=${id}`
          : ROUTES.ADMIN_CONTRACTS;
      case "service_order":
        return id
          ? `${ROUTES.ADMIN_SERVICES}?order=${id}`
          : ROUTES.ADMIN_SERVICES;
      case "reminder":
        return ROUTES.ADMIN_REMINDERS;
      case "schedule_appointment":
      case "appointment":
        return ROUTES.ADMIN_APPOINTMENTS;
      case "transfer_request":
      case "transfer":
      case "ownership_record":
      case "ownership":
        return ROUTES.ADMIN_TRANSFER;
      case "deceased_profile":
        return id
          ? `${ROUTES.ADMIN_DECEASED}?profileId=${id}`
          : ROUTES.ADMIN_DECEASED;
      case "plot":
        return ROUTES.ADMIN_MAP;
      default:
        return null;
    }
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
