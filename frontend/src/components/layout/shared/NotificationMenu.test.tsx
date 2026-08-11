import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import NotificationMenu from "./NotificationMenu";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
const realtimeMock = vi.hoisted(() => ({
  topics: [] as string[],
  refresh: undefined as undefined | (() => void | Promise<void>),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));
vi.mock("@/hooks/useRealtimeRefresh", () => ({
  useRealtimeRefresh: (topics: string[], refresh: () => void | Promise<void>) => {
    realtimeMock.topics = topics;
    realtimeMock.refresh = refresh;
  },
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
    id: 2,
    type: "service_completed",
    title: "Dịch vụ đã hoàn tất",
    message: "Dịch vụ chăm sóc đã được hoàn thành.",
    isRead: false,
    relatedEntityType: "service_order",
    relatedEntityId: 12,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: 1,
    type: "future_notification_type",
    title: "Thông báo hệ thống",
    message: "Loại mới vẫn được hiển thị.",
    isRead: true,
    createdAt: "2026-07-31T08:00:00.000Z",
  },
];

describe("NotificationMenu", () => {
  beforeEach(() => {
    realtimeMock.topics = [];
    realtimeMock.refresh = undefined;
    apiMocks.get.mockResolvedValue({
      data: { success: true, data: notifications },
    });
    apiMocks.patch.mockResolvedValue({ data: { success: true } });
    apiMocks.delete.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows the unread badge and every notification type in newest-first order", async () => {
    render(
      <MemoryRouter>
        <NotificationMenu />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole("button", {
      name: "Thông báo, 1 chưa đọc",
    });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "Thông báo gần đây" }),
    ).toBeInTheDocument();
    const titles = screen.getAllByText(
      /Dịch vụ đã hoàn tất|Thông báo hệ thống/,
    );
    expect(titles[0]).toHaveTextContent("Dịch vụ đã hoàn tất");
    expect(screen.getByText("Future Notification Type")).toBeInTheDocument();
  });

  it("marks a clicked notification read without leaving the popup and supports mark-all", async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        success: true,
        data: notifications.map((item) => ({ ...item, isRead: false })),
      },
    });
    render(
      <MemoryRouter>
        <NotificationMenu variant="light" />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Thông báo, 2 chưa đọc" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dịch vụ đã hoàn tất/ }),
    );

    await waitFor(() =>
      expect(apiMocks.patch).toHaveBeenCalledWith("/notifications/2/read"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }),
    );
    await waitFor(() =>
      expect(apiMocks.patch).toHaveBeenCalledWith("/notifications/read-all"),
    );
  });

  it("guards clear-all and removes the current list after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <NotificationMenu />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xóa tất cả thông báo" }),
    );

    await waitFor(() =>
      expect(apiMocks.delete).toHaveBeenCalledWith("/notifications"),
    );
    expect(
      await screen.findByText("Chưa có thông báo nào."),
    ).toBeInTheDocument();
  });

  it("refreshes from the API when the realtime notifications topic changes", async () => {
    apiMocks.get
      .mockResolvedValueOnce({ data: { success: true, data: notifications } })
      .mockResolvedValueOnce({ data: { success: true, data: [] } });

    render(
      <MemoryRouter>
        <NotificationMenu />
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(1));
    expect(realtimeMock.topics).toEqual(["notifications"]);

    await act(async () => {
      await realtimeMock.refresh?.();
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(2);
  });

  it("queues a realtime reload that arrives while another load is in flight", async () => {
    let resolveInitial!: (value: {
      data: { success: boolean; data: typeof notifications };
    }) => void;
    apiMocks.get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
      )
      .mockResolvedValueOnce({
        data: { success: true, data: notifications },
      });

    render(
      <MemoryRouter>
        <NotificationMenu />
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(1));
    await act(async () => {
      await realtimeMock.refresh?.();
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInitial({ data: { success: true, data: notifications } });
    });
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
  });

  it("uses admin routes for the notification center and related entities", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <NotificationMenu audience="admin" variant="light" />
        <CurrentLocation />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dịch vụ đã hoàn tất/ }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        "/admin/dich-vu?order=12",
      ),
    );
  });

  it("opens the customer request view for a cancellation notification", async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 8,
            type: "request_cancellation_approved",
            title: "Yêu cầu hủy đã được duyệt",
            message: "Yêu cầu mua lô của bạn đã được hủy.",
            isRead: false,
            relatedEntityType: "reservation_request",
            relatedEntityId: 42,
            createdAt: "2026-08-11T08:00:00.000Z",
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/thong-bao"]}>
        <NotificationMenu />
        <CurrentLocation />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Yêu cầu hủy đã được duyệt/ }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        "/lo-cua-toi?request=42#requests",
      ),
    );
  });

  it("opens the admin notification center from the menu footer", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <NotificationMenu audience="admin" variant="light" />
        <CurrentLocation />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xem tất cả thông báo" }),
    );

    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/admin/thong-bao",
    );
  });

  it("shows and auto-dismisses an admin toast for a new realtime notification", async () => {
    const newNotification = {
      id: 3,
      type: "request_submitted",
      title: "Có yêu cầu mua lô mới",
      message: "Khách hàng vừa gửi yêu cầu cần xử lý.",
      isRead: false,
      relatedEntityType: "reservation_request",
      relatedEntityId: 45,
      createdAt: "2026-08-02T08:00:00.000Z",
    };
    apiMocks.get
      .mockResolvedValueOnce({
        data: { success: true, data: notifications },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [newNotification, ...notifications] },
      });

    render(
      <MemoryRouter>
        <NotificationMenu audience="admin" variant="light" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    await act(async () => {
      await realtimeMock.refresh?.();
    });
    expect(
      screen.getByRole("button", { name: /Có yêu cầu mua lô mới/ }),
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(6_000));
    expect(
      screen.queryByRole("button", { name: /Có yêu cầu mua lô mới/ }),
    ).not.toBeInTheDocument();
  });
});
