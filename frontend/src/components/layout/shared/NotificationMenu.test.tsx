import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import NotificationMenu from "./NotificationMenu";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

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

  it("refreshes from the real API every second without overlapping requests", async () => {
    vi.useFakeTimers();
    let resolveRefresh: ((value: unknown) => void) | undefined;
    apiMocks.get
      .mockResolvedValueOnce({ data: { success: true, data: notifications } })
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

    render(
      <MemoryRouter>
        <NotificationMenu />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh?.({ data: { success: true, data: notifications } });
      await Promise.resolve();
    });
  });
});
