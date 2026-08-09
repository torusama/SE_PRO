import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRealtimeRefresh } from "./useRealtimeRefresh";

const realtimeListeners = vi.hoisted(() => ({
  update: undefined as
    | undefined
    | ((update: { topics: string[]; occurredAt: string }) => void),
  reconnect: undefined as undefined | (() => void),
}));

vi.mock("@/lib/realtime", () => ({
  onRealtimeUpdate: (
    listener: (update: { topics: string[]; occurredAt: string }) => void,
  ) => {
    realtimeListeners.update = listener;
    return () => {
      realtimeListeners.update = undefined;
    };
  },
  onRealtimeReconnect: (listener: () => void) => {
    realtimeListeners.reconnect = listener;
    return () => {
      realtimeListeners.reconnect = undefined;
    };
  },
}));

describe("useRealtimeRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
    realtimeListeners.update = undefined;
    realtimeListeners.reconnect = undefined;
  });

  it("filters topics, collapses bursts and refreshes once after reconnect", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRealtimeRefresh(["plots"], refresh, 50));

    act(() => {
      realtimeListeners.update?.({
        topics: ["notifications"],
        occurredAt: new Date().toISOString(),
      });
      vi.advanceTimersByTime(100);
    });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      realtimeListeners.update?.({
        topics: ["plots"],
        occurredAt: new Date().toISOString(),
      });
      realtimeListeners.update?.({
        topics: ["plots"],
        occurredAt: new Date().toISOString(),
      });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      realtimeListeners.reconnect?.();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
