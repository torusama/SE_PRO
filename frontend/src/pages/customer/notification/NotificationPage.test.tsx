import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import NotificationPage from "./NotificationPage";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));
vi.mock("@/hooks/useRealtimeRefresh", () => ({
  useRealtimeRefresh: vi.fn(),
}));

function CurrentLocation() {
  const location = useLocation();
  return (
    <output data-testid="current-location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

const notifications = [
  {
    id: 3,
    type: "request_cancellation_submitted",
    title: "Khách đã gửi yêu cầu hủy",
    message: "Yêu cầu hủy mua lô đang chờ quản trị viên duyệt.",
    isRead: false,
    relatedEntityType: "reservation_request",
    relatedEntityId: 42,
    createdAt: "2026-08-11T08:00:00.000Z",
  },
  {
    id: 2,
    type: "request_cancelled",
    title: "Yêu cầu cũ đã hủy",
    message: "Thông báo hủy theo mã legacy vẫn thuộc nhóm hủy.",
    isRead: true,
    relatedEntityType: "reservation_request",
    relatedEntityId: 40,
    createdAt: "2026-08-10T08:00:00.000Z",
  },
  {
    id: 1,
    type: "request_submitted",
    title: "Yêu cầu mua lô mới",
    message: "Yêu cầu mua lô đang chờ duyệt.",
    isRead: false,
    relatedEntityType: "reservation_request",
    relatedEntityId: 41,
    createdAt: "2026-08-09T08:00:00.000Z",
  },
];

describe("NotificationPage cancellation group", () => {
  beforeEach(() => {
    apiMocks.get.mockReset().mockResolvedValue({
      data: { success: true, data: notifications },
    });
    apiMocks.patch.mockReset().mockResolvedValue({
      data: { success: true },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("separates cancellation notifications and opens the matching request", async () => {
    render(
      <MemoryRouter initialEntries={["/thong-bao"]}>
        <NotificationPage />
        <CurrentLocation />
      </MemoryRouter>,
    );

    await screen.findByText("Khách đã gửi yêu cầu hủy");
    fireEvent.click(
      screen.getByRole("button", { name: /Hủy yêu cầu lô/ }),
    );

    expect(screen.getByText("Khách đã gửi yêu cầu hủy")).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu cũ đã hủy")).toBeInTheDocument();
    expect(screen.queryByText("Yêu cầu mua lô mới")).not.toBeInTheDocument();
    expect(screen.getAllByText("Hủy yêu cầu mua lô")).toHaveLength(2);

    fireEvent.click(
      screen.getByText("Khách đã gửi yêu cầu hủy").closest("article")!,
    );

    await waitFor(() =>
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        "/lo-cua-toi?request=42#requests",
      ),
    );
    expect(apiMocks.patch).toHaveBeenCalledWith("/notifications/3/read");
  });
});
