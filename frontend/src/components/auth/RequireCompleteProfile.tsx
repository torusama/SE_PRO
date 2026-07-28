// src/components/auth/RequireCompleteProfile.tsx
// Chặn các trang chức năng chính khi hồ sơ cá nhân chưa đủ trường bắt buộc.
// Email tài khoản đã được xác thực trong luồng đăng ký, nên không yêu cầu OTP
// lần hai khi người dùng cập nhật hồ sơ.
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";

export default function RequireCompleteProfile() {
  const profileComplete = useAuthStore((s) => s.profileComplete);
  const role = useAuthStore((s) => s.role);
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete);
  const location = useLocation();
  const [checking, setChecking] = useState(profileComplete === null);

  useEffect(() => {
    if (role === "admin" || profileComplete !== null) return;
    let cancelled = false;
    api
      .get("/users/me")
      .then((res) => {
        const data = res.data?.data ?? {};
        const canAccess = Boolean(data.isProfileComplete);
        if (!cancelled) setProfileComplete(canAccess);
      })
      .catch(() => {
        // Nếu không kiểm tra được (lỗi mạng...), không chặn người dùng —
        // để RequireAuth/401-interceptor xử lý các lỗi xác thực thật sự.
        if (!cancelled) setProfileComplete(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileComplete, role, setProfileComplete]);

  if (role === "admin") return <Outlet />;

  if (checking) return null;

  if (profileComplete === false) {
    return (
      <Navigate
        to={ROUTES.PROFILE}
        state={{ from: location, requireProfile: true }}
        replace
      />
    );
  }

  return <Outlet />;
}
