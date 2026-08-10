import { act, cleanup, render, waitFor } from "@testing-library/react";
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
});
