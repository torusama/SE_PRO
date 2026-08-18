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
import NotificationManagementPage from "./NotificationManagementPage";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
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

describe("NotificationManagementPage realtime feed", () => {
  beforeEach(() => {
    realtimeMock.topics = [];
    realtimeMock.refresh = undefined;
    apiMocks.get.mockReset();
    apiMocks.patch.mockReset().mockResolvedValue({ data: { success: true } });
    apiMocks.post.mockReset().mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("queues a realtime feed reload while the current request is in flight", async () => {
    let resolveInitial!: (value: {
      data: { success: boolean; data: unknown[] };
    }) => void;
    apiMocks.get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
      )
      .mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

    render(
      <MemoryRouter>
        <NotificationManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(1));
    expect(apiMocks.get).toHaveBeenNthCalledWith(1, "/notifications");
    expect(realtimeMock.topics).toEqual(["notifications"]);

    await act(async () => {
      await realtimeMock.refresh?.();
    });
    expect(apiMocks.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInitial({ data: { success: true, data: [] } });
    });

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
    expect(apiMocks.get).toHaveBeenNthCalledWith(2, "/notifications");
  });

  it("shows reservation cancellations in their own section", async () => {
    apiMocks.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 12,
            type: "request_cancellation_submitted",
            title: "Khách hàng xin hủy yêu cầu mua lô",
            message: "Yêu cầu hủy đang chờ quản trị viên xử lý.",
            isRead: false,
            relatedEntityType: "reservation_request",
            relatedEntityId: 42,
            createdAt: "2026-08-11T08:00:00.000Z",
          },
          {
            id: 11,
            type: "request_submitted",
            title: "Yêu cầu mua lô mới",
            message: "Yêu cầu mua lô đang chờ duyệt.",
            isRead: false,
            relatedEntityType: "reservation_request",
            relatedEntityId: 41,
            createdAt: "2026-08-10T08:00:00.000Z",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <NotificationManagementPage />
      </MemoryRouter>,
    );

    await screen.findByText("Khách hàng xin hủy yêu cầu mua lô");
    fireEvent.click(
      screen.getByRole("button", { name: /Hủy yêu cầu lô/ }),
    );

    expect(
      screen.getByText("Khách hàng xin hủy yêu cầu mua lô"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Yêu cầu mua lô mới")).not.toBeInTheDocument();
  });
});
