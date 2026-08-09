import { useEffect } from "react";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { useAuthStore } from "@/store/authStore";

export default function RealtimeConnection() {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    connectRealtime(token);
    return disconnectRealtime;
  }, [token]);

  return null;
}
