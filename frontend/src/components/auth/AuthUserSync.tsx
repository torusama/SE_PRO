import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

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
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    api
      .get("/users/me")
      .then((response) => {
        if (cancelled) return;

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
      })
      .catch(() => {
        // The global API interceptor handles an expired/revoked session.
        // For transient errors, keep the existing session and retry next load.
      });

    return () => {
      cancelled = true;
    };
  }, [setUser, token]);

  return null;
}
