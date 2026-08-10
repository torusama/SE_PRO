import { describe, expect, it } from "vitest";
import { notificationTargetRoute, type NotificationItem } from "./notification-menu-utils";

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
