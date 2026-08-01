// src/components/layout/customer/Navbar.tsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/authStore";
import "./Navbar.css";

const TXT = {
  brandPart1: "VĨNH PHÚC",
  brandPart2: "VIÊN",
  agent: "TRỢ LÝ AI",
  map: "BẢN ĐỒ",
  services: "DỊCH VỤ",
  login: "ĐẮNG NHẬP",
  profile: "Hồ sơ cá nhân",
  myLots: "Lô của tôi",
  appointments: "Lịch hẹn tư vấn",
  admin: "Trang Quản trị",
  logout: "Đăng xuất",
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const isProfilePage = location.pathname === ROUTES.PROFILE;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate(ROUTES.HOME);
  };

  return (
    <nav className="site-nav">
      <Link to={ROUTES.HOME} className="site-nav-brand">
        <span>{TXT.brandPart1}</span> {TXT.brandPart2}
      </Link>

      <ul className="site-nav-links">
        <li>
          <Link
            to={ROUTES.MAP}
            className={location.pathname === ROUTES.MAP ? "active" : ""}
          >
            {TXT.map}
          </Link>
        </li>
        <li>
          <Link
            to={ROUTES.SERVICES}
            className={location.pathname === ROUTES.SERVICES ? "active" : ""}
          >
            {TXT.services}
          </Link>
        </li>
        <li>
          <Link
            to={ROUTES.AI_AGENT}
            className={location.pathname === ROUTES.AI_AGENT ? "active" : ""}
          >
            {TXT.agent}
          </Link>
        </li>
      </ul>

      {isProfilePage ? null : user ? (
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
                  navigate(ROUTES.MY_LOTS);
                }}
              >
                {TXT.myLots}
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
