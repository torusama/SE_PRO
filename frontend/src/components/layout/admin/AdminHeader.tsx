import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const PAGE_META: Record<string, { title: string; description: string }> = {
  [ROUTES.ADMIN_DASHBOARD]: {
    title: "Tổng quan",
    description: "Tình hình vận hành nghĩa trang",
  },
  [ROUTES.ADMIN_ACTIVITY]: {
    title: "Hoạt động",
    description: "Nhật ký cập nhật gần đây",
  },
  [ROUTES.ADMIN_MAP]: {
    title: "Bản đồ 2D",
    description: "Sơ đồ và trạng thái các lô đất",
  },
  [ROUTES.ADMIN_LOTS]: {
    title: "Quản lý lô đất",
    description: "Thông tin, trạng thái và vị trí lô",
  },
  [ROUTES.ADMIN_REQUESTS]: {
    title: "Xử lý yêu cầu",
    description: "Tiếp nhận và theo dõi yêu cầu",
  },
  [ROUTES.ADMIN_CONTRACTS]: {
    title: "Hợp đồng và sở hữu",
    description: "Hồ sơ hợp đồng trong hệ thống",
  },
  [ROUTES.ADMIN_SERVICES]: {
    title: "Quản lý dịch vụ",
    description: "Danh mục và đơn đăng ký dịch vụ",
  },
  [ROUTES.ADMIN_NOTIFY]: {
    title: "Thông báo",
    description: "Nội dung gửi đến người dùng",
  },
  [ROUTES.ADMIN_TRANSFER]: {
    title: "Chuyển nhượng",
    description: "Hồ sơ chuyển quyền sử dụng lô",
  },
  [ROUTES.ADMIN_APPOINTMENTS]: {
    title: "Lịch hẹn",
    description: "Phê duyệt và quản lý lịch hẹn",
  },
  [ROUTES.ADMIN_REMINDERS]: {
    title: "Nhắc lịch",
    description: "Ngày giỗ và sự kiện tưởng niệm",
  },
  [ROUTES.ADMIN_AI_AGENT]: {
    title: "AI Agent",
    description: "Theo dõi tri thức và quá trình học",
  },
};

export default function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const page = PAGE_META[location.pathname] ?? PAGE_META[ROUTES.ADMIN_DASHBOARD];

  function handleLogout() {
    api.post("/auth/logout").catch(() => {});
    logout();
    navigate(ROUTES.LOGIN);
  }

  return (
    <header className="admin-header">
      <div className="admin-header__page">
        <p className="admin-header__title">{page.title}</p>
        <p className="admin-header__description">{page.description}</p>
      </div>

      {user && (
        <div className="admin-account">
          <button
            type="button"
            className="admin-account__trigger"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="admin-account__name">{user.name}</span>
            <span className="admin-account__hint">
              {menuOpen ? "Đóng" : "Tài khoản"}
            </span>
          </button>

          {menuOpen && (
            <div className="admin-account__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.PROFILE);
                }}
              >
                Hồ sơ của tôi
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.APPOINTMENTS);
                }}
              >
                Đặt và xem lịch hẹn
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.ADMIN_DASHBOARD);
                }}
              >
                Trang quản trị
              </button>
              <button
                type="button"
                role="menuitem"
                className="admin-account__logout"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
