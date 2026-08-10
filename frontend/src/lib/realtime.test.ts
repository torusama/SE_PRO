import { afterEach, describe, expect, it, vi } from "vitest";

const socketMocks = vi.hoisted(() => {
  const handlers: Record<string, ((...args: never[]) => void) | undefined> = {};
  const managerHandlers: Record<
    string,
    ((...args: never[]) => void) | undefined
  > = {};
  const socket = {
    connected: false,
    on: vi.fn((event: string, listener: (...args: never[]) => void) => {
      handlers[event] = listener;
      return socket;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    io: {
      on: vi.fn((event: string, listener: (...args: never[]) => void) => {
        managerHandlers[event] = listener;
      }),
      removeAllListeners: vi.fn(),
    },
  };
  return { handlers, managerHandlers, socket, io: vi.fn(() => socket) };
});

vi.mock("socket.io-client", () => ({ io: socketMocks.io }));
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "http://localhost:3001/api",
}));
vi.mock("@/store/authStore", () => ({
  useAuthStore: {
    getState: () => ({ token: null, logout: vi.fn() }),
  },
}));

import {
  connectRealtime,
  disconnectRealtime,
  isRealtimeConnected,
  onRealtimeConnect,
  onRealtimeConnectionChange,
} from "./realtime";

describe("realtime client", () => {
  afterEach(() => {
    disconnectRealtime();
    vi.clearAllMocks();
  });

  it("prefers websocket, falls back to polling and reports every connection", () => {
    const connectionStates: boolean[] = [];
    const connected = vi.fn();
    const removeConnection = onRealtimeConnectionChange((state) =>
      connectionStates.push(state),
    );
    const removeConnect = onRealtimeConnect(connected);

    connectRealtime("jwt-token");

    expect(socketMocks.io).toHaveBeenCalledWith(
      "http://localhost:3001/realtime",
      expect.objectContaining({
        auth: { token: "jwt-token" },
        transports: ["websocket", "polling"],
        tryAllTransports: true,
      }),
    );
    expect(socketMocks.socket.connect).toHaveBeenCalledOnce();
    expect(connectionStates).toEqual([false]);

    socketMocks.handlers.connect?.();
    expect(isRealtimeConnected()).toBe(true);
    expect(connectionStates).toEqual([false, true]);
    expect(connected).toHaveBeenCalledTimes(1);

    socketMocks.handlers.disconnect?.();
    expect(isRealtimeConnected()).toBe(false);
    expect(connectionStates).toEqual([false, true, false]);

    socketMocks.handlers.connect?.();
    expect(isRealtimeConnected()).toBe(true);
    expect(connected).toHaveBeenCalledTimes(2);

    removeConnect();
    removeConnection();
  });
});
