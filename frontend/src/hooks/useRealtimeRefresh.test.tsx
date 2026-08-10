import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRealtimeRefresh } from "./useRealtimeRefresh";

const realtimeListeners = vi.hoisted(() => ({
  update: undefined as
    | undefined
    | ((update: { topics: string[]; occurredAt: string }) => void),
  connect: undefined as undefined | (() => void),
  connection: undefined as undefined | ((connected: boolean) => void),
  connected: true,
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
  onRealtimeConnect: (listener: () => void) => {
    realtimeListeners.connect = listener;
    return () => {
      realtimeListeners.connect = undefined;
    };
  },
  onRealtimeConnectionChange: (listener: (connected: boolean) => void) => {
    realtimeListeners.connection = listener;
    listener(realtimeListeners.connected);
    return () => {
      realtimeListeners.connection = undefined;
    };
  },
}));

describe("useRealtimeRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
    realtimeListeners.update = undefined;
    realtimeListeners.connect = undefined;
    realtimeListeners.connection = undefined;
    realtimeListeners.connected = true;
  });

  it("filters topics, collapses bursts and refreshes on every connect", async () => {
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
      realtimeListeners.connect?.();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("polls only while disconnected and stops immediately after connect", async () => {
    vi.useFakeTimers();
    realtimeListeners.connected = false;
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRealtimeRefresh(["plots"], refresh, 20, 100));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      realtimeListeners.connected = true;
      realtimeListeners.connection?.(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      realtimeListeners.connect?.();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
