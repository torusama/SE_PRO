import { useEffect, useRef } from "react";
import {
  onRealtimeReconnect,
  onRealtimeUpdate,
  type RealtimeTopic,
} from "@/lib/realtime";

type Refresh = () => void | Promise<void>;

/**
 * Refreshes mounted data after a matching server event. Bursts are collapsed
 * and a second run is queued when an event arrives while the first is active.
 */
export function useRealtimeRefresh(
  topics: readonly RealtimeTopic[],
  refresh: Refresh,
  debounceMs = 120,
) {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);
  const topicKey = [...topics].sort().join("|");

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const topicSet = new Set<RealtimeTopic>(
      topicKey ? (topicKey.split("|") as RealtimeTopic[]) : [],
    );

    const run = async () => {
      timerRef.current = null;
      if (runningRef.current) {
        pendingRef.current = true;
        return;
      }

      runningRef.current = true;
      try {
        await refreshRef.current();
      } catch {
        // The mounted screen owns its error UI. A later event/reconnect retries.
      } finally {
        runningRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          timerRef.current = window.setTimeout(() => void run(), debounceMs);
        }
      }
    };

    const schedule = () => {
      pendingRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void run(), debounceMs);
    };

    const removeUpdateListener = onRealtimeUpdate((update) => {
      if (update.topics.some((topic) => topicSet.has(topic))) schedule();
    });
    const removeReconnectListener = onRealtimeReconnect(schedule);

    return () => {
      removeUpdateListener();
      removeReconnectListener();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = false;
    };
  }, [debounceMs, topicKey]);
}
