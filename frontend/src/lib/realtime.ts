import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export const REALTIME_TOPICS = [
  "plots",
  "reservations",
  "contracts",
  "ownership",
  "notifications",
  "services",
  "appointments",
  "reminders",
  "users",
  "sessions",
  "authorized-persons",
  "transfers",
  "deceased",
  "families",
  "dashboard",
  "audit",
  "ai",
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export type RealtimeUpdate = {
  topics: RealtimeTopic[];
  occurredAt: string;
};

type UpdateListener = (update: RealtimeUpdate) => void;
type ReconnectListener = () => void;

const updateListeners = new Set<UpdateListener>();
const reconnectListeners = new Set<ReconnectListener>();
let socket: Socket | null = null;
let currentToken: string | null | undefined;

function realtimeUrl() {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.pathname = url.pathname.replace(/\/api\/?$/, "").replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return `${url.toString().replace(/\/$/, "")}/realtime`;
}

function destroySocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.io.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function invalidateAuthenticatedSession() {
  const auth = useAuthStore.getState();
  if (!auth.token) return;
  auth.logout();
  if (window.location.pathname !== "/login") window.location.href = "/login";
}

export function connectRealtime(token: string | null) {
  if (socket && currentToken === token) {
    if (!socket.connected) socket.connect();
    return;
  }

  destroySocket();
  currentToken = token;
  socket = io(realtimeUrl(), {
    autoConnect: false,
    auth: token ? { token } : {},
    reconnection: true,
    transports: ["websocket"],
    withCredentials: true,
  });

  socket.on("realtime:update", (update: RealtimeUpdate) => {
    if (!Array.isArray(update?.topics)) return;
    updateListeners.forEach((listener) => listener(update));
  });
  socket.on("realtime:session-revoked", invalidateAuthenticatedSession);
  socket.on("connect_error", (error: Error) => {
    if (error.message.toLowerCase().includes("unauthorized")) {
      invalidateAuthenticatedSession();
    }
  });
  // Manager's reconnect event is not emitted for the initial connection.
  socket.io.on("reconnect", () => {
    reconnectListeners.forEach((listener) => listener());
  });
  socket.connect();
}

export function disconnectRealtime() {
  currentToken = undefined;
  destroySocket();
}

export function onRealtimeUpdate(listener: UpdateListener) {
  updateListeners.add(listener);
  return () => updateListeners.delete(listener);
}

export function onRealtimeReconnect(listener: ReconnectListener) {
  reconnectListeners.add(listener);
  return () => reconnectListeners.delete(listener);
}
