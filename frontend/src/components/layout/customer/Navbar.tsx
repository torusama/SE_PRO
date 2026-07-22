// src/components/layout/customer/Navbar.tsx
// Đồng bộ 1:1 với thanh nav của Trang chủ (xem .home-nav trong HomePage.tsx/HomePage.css).
// Toàn bộ trang trong CustomerLayout (Hồ sơ, Bản đồ, Dịch vụ, Lô của tôi...) dùng chung
// component này nên chỉ cần sửa ở đây là mọi nơi đồng bộ theo.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import "./Navbar.css";

const TXT = {
  brandMain: "VĨNH PHÚC",
  brandAccent: "VIÊN",
  profile: "Hồ sơ của tôi",
  appointments: "Đặt và xem lịch hẹn",
  admin: "Trang quản trị",
  logout: "Đăng xuất",
  login: "Đăng nhập",
};

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    // Thu hồi phiên thật ở backend (bảng user_sessions) — không chặn UI chờ
    // kết quả, vì dù request lỗi thì local state vẫn phải được xoá ngay.
    api.post("/auth/logout").catch(() => {});
    logout();
    setMenuOpen(false);
    navigate(ROUTES.LOGIN);
  }

  return (
    <nav className="site-nav">
      <Link to={ROUTES.HOME} className="site-nav-logo">
        {TXT.brandMain} <span>{TXT.brandAccent}</span>
      </Link>

      {user ? (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="site-nav-user"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="site-nav-avatar">{user.initials}</span>
            <span className="site-nav-username">{user.name}</span>
          </button>

          {menuOpen && (
            <div className="site-nav-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.PROFILE);
                }}
              >
                {TXT.profile}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.APPOINTMENTS);
                }}
              >
                {TXT.appointments}
              </button>
              {role === "admin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(ROUTES.ADMIN_DASHBOARD);
                  }}
                >
                  {TXT.admin}
                </button>
              )}
              <button type="button" className="danger" onClick={handleLogout}>
                {TXT.logout}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="site-nav-cta"
          onClick={() => navigate(ROUTES.LOGIN)}
        >
          {TXT.login}
        </button>
      )}
    </nav>
  );
}
