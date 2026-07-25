// src/components/layout/admin/AdminHeader.tsx
import type { CSSProperties } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";
import { Bell } from "lucide-react";

export default function AdminHeader() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    api.post("/auth/logout").catch(() => {});
    logout();
    navigate(ROUTES.LOGIN);
  }

  return (
    <header
      style={{
        height: 52,
        background: "#ffffff",
        borderBottom: "1px solid #e5e2da",
      }}
      className="flex items-center justify-between px-7"
    >
      {/* Left */}
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#1a1a1a",
          }}
        >
          Dashboard
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#888",
          }}
        >
          Tổng quan hệ thống
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          style={{
            width: 34,
            height: 34,
            border: "1px solid #e5e2da",
            borderRadius: 8,
            background: "#fff",
          }}
          className="flex items-center justify-center hover:bg-[#E7F5F3]"
        >
          <Bell size={16} color="#555" />
        </button>

        {user && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                color: "#333",
                fontSize: 13,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              {user.name}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #e5e2da",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  minWidth: 190,
                  overflow: "hidden",
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(ROUTES.PROFILE);
                  }}
                  style={menuItemStyle}
                >
                  Hồ sơ của tôi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(ROUTES.APPOINTMENTS);
                  }}
                  style={menuItemStyle}
                >
                  Đặt và xem lịch hẹn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(ROUTES.ADMIN_DASHBOARD);
                  }}
                  style={menuItemStyle}
                >
                  Trang quản trị
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  style={{ ...menuItemStyle, color: "#c0392b" }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

const menuItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 13,
  color: "#333",
  background: "none",
  border: "none",
  borderBottom: "1px solid #f0efe9",
  cursor: "pointer",
};