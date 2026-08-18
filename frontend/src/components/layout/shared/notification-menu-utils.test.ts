import { describe, expect, it } from "vitest";
import {
  isRequestCancellationType,
  notificationTargetRoute,
  notificationTypeLabel,
  type NotificationItem,
} from "./notification-menu-utils";

const cancellationTypes = [
  "request_cancelled",
  "request_cancelled_by_customer",
  "request_cancellation_submitted",
  "request_cancellation_approved",
  "request_cancellation_rejected",
];

const cancellationNotification: NotificationItem = {
  id: 9,
  type: "request_cancellation_submitted",
  title: "Yêu cầu hủy mới",
  message: "Khách hàng muốn hủy yêu cầu mua lô.",
  isRead: false,
  relatedEntityType: "reservation_request",
  relatedEntityId: 42,
  createdAt: "2026-08-11T08:00:00.000Z",
};

function notification(
  relatedEntityType: string,
  relatedEntityId = 12,
): NotificationItem {
  return {
    id: 1,
    type: "system_update",
    title: "Cập nhật",
    message: "Có dữ liệu mới.",
    isRead: false,
    relatedEntityType,
    relatedEntityId,
    createdAt: "2026-08-10T00:00:00.000Z",
  };
}

describe("cancellation notification utilities", () => {
  it("recognizes every cancellation lifecycle type including the legacy type", () => {
    cancellationTypes.forEach((type) => {
      expect(isRequestCancellationType(type)).toBe(true);
    });
    expect(isRequestCancellationType("request_submitted")).toBe(false);
  });

  it("uses the dedicated customer and admin cancellation routes", () => {
    expect(notificationTargetRoute(cancellationNotification)).toBe(
      "/lo-cua-toi?request=42#requests",
    );
    expect(notificationTargetRoute(cancellationNotification, "admin")).toBe(
      "/admin/yeu-cau?view=cancellations&request=42",
    );
  });

  it("shows readable labels for cancellation results", () => {
    expect(notificationTypeLabel("request_cancellation_approved")).toBe(
      "Yêu cầu hủy đã được duyệt",
    );
    expect(notificationTypeLabel("request_cancellation_rejected")).toBe(
      "Yêu cầu hủy bị từ chối",
    );
  });
});

describe("notificationTargetRoute for admins", () => {
  it.each([
    ["reservation_request", "/admin/yeu-cau?request=12"],
    ["offline_appointment", "/admin/yeu-cau?appointment=12"],
    ["contract", "/admin/hop-dong?contractId=12"],
    ["service_order", "/admin/dich-vu?order=12"],
    ["reminder", "/admin/nhac-lich"],
    ["deceased_profile", "/admin/ho-so-nguoi-da-khuat?profileId=12"],
    ["ownership", "/admin/chuyen-nhuong"],
    ["plot", "/admin/ban-do"],
  ])("maps %s to %s", (entityType, expected) => {
    expect(notificationTargetRoute(notification(entityType), "admin")).toBe(
      expected,
    );
  });
});
