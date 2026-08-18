import { useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

function buildInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "KH";
}

/**
 * Refresh the persisted auth user from the database when the application
 * starts. This prevents stale profile data in `auth-storage` from continuing
 * to appear in the home-page and shared navigation bars.
 */
export default function AuthUserSync() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const setUser = useAuthStore((state) => state.setUser);
  const setProfileComplete = useAuthStore(
    (state) => state.setProfileComplete,
  );

  const syncUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get("/users/me");
      const profile = response.data?.data ?? response.data;
      const fullName =
        profile?.fullName ?? profile?.full_name ?? profile?.name ?? "";
      if (!fullName || !profile?.email) return;

      setUser({
        id: String(profile.id ?? profile.user_id),
        name: fullName,
        initials: buildInitials(fullName),
        email: profile.email,
      });
      setProfileComplete(role === "admin" || Boolean(profile.isProfileComplete));
    } catch {
      // The global API interceptor handles an expired/revoked session.
      // For transient errors, keep the existing session and retry on reconnect.
    }
  }, [role, setProfileComplete, setUser, token]);

  useEffect(() => {
    void syncUser();
  }, [syncUser]);

  useRealtimeRefresh(["users"], syncUser);

  return null;
}
