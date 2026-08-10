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
type ConnectListener = () => void;
type ConnectionListener = (connected: boolean) => void;

const updateListeners = new Set<UpdateListener>();
const connectListeners = new Set<ConnectListener>();
const connectionListeners = new Set<ConnectionListener>();
let socket: Socket | null = null;
let currentToken: string | null | undefined;
let connected = false;

function realtimeUrl() {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.pathname = url.pathname.replace(/\/api\/?$/, "").replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return `${url.toString().replace(/\/$/, "")}/realtime`;
}

function destroySocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  setConnected(false);
}

function setConnected(nextConnected: boolean) {
  if (connected === nextConnected) return;
  connected = nextConnected;
  connectionListeners.forEach((listener) => listener(connected));
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
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    withCredentials: true,
  });

  socket.on("connect", () => {
    setConnected(true);
    connectListeners.forEach((listener) => listener());
  });
  socket.on("disconnect", () => setConnected(false));
  socket.on("realtime:update", (update: RealtimeUpdate) => {
    if (!Array.isArray(update?.topics)) return;
    updateListeners.forEach((listener) => listener(update));
  });
  socket.on("realtime:session-revoked", invalidateAuthenticatedSession);
  socket.on("connect_error", (error: Error) => {
    setConnected(false);
    if (error.message.toLowerCase().includes("unauthorized")) {
      invalidateAuthenticatedSession();
    }
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

export function onRealtimeConnect(listener: ConnectListener) {
  connectListeners.add(listener);
  return () => connectListeners.delete(listener);
}

export function onRealtimeConnectionChange(listener: ConnectionListener) {
  connectionListeners.add(listener);
  listener(connected);
  return () => connectionListeners.delete(listener);
}

export function isRealtimeConnected() {
  return connected;
}
