import { NavLink, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { useAuthStore } from "@/store/authStore";

type MenuItem = {
  label: string;
  to: string;
  badge?: number;
};

type MenuGroup = {
  section: string;
  items: MenuItem[];
};

const MENU: MenuGroup[] = [
  {
    section: "Tổng quan",
    items: [
      { label: "Dashboard", to: ROUTES.ADMIN_DASHBOARD },
      { label: "Hoạt động gần đây", to: ROUTES.ADMIN_ACTIVITY },
    ],
  },
  {
    section: "Lô đất",
    items: [
      { label: "Bản đồ 2D", to: ROUTES.ADMIN_MAP },
      { label: "Quản lý lô đất", to: ROUTES.ADMIN_LOTS },
      { label: "Xử lý yêu cầu", to: ROUTES.ADMIN_REQUESTS },
    ],
  },
  {
    section: "Giao dịch",
    items: [
      { label: "Hợp đồng & Sở hữu", to: ROUTES.ADMIN_CONTRACTS },
      { label: "Quản lý dịch vụ", to: ROUTES.ADMIN_SERVICES },
      { label: "Thông báo", to: ROUTES.ADMIN_NOTIFY },
      { label: "Chuyển nhượng", to: ROUTES.ADMIN_TRANSFER },
      { label: "Phê duyệt lịch hẹn", to: ROUTES.ADMIN_APPOINTMENTS },
      { label: "Nhắc lịch ngày giỗ", to: ROUTES.ADMIN_REMINDERS },
    ],
  },
  {
    section: "AI Agent",
    items: [{ label: "Quản trị AI Agent", to: ROUTES.ADMIN_AI_AGENT }],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <button type="button" onClick={() => navigate(ROUTES.HOME)}>
          Vĩnh Phúc Viên
        </button>
        <p>Quản trị nghĩa trang</p>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Điều hướng quản trị">
        {MENU.map((group) => (
          <section className="admin-nav-group" key={group.section}>
            <p className="admin-nav-group__label">{group.section}</p>
            <div className="admin-nav-group__items">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === ROUTES.ADMIN_DASHBOARD}
                  className={({ isActive }) =>
                    `admin-nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="admin-nav-link__badge">{item.badge}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      {user && (
        <div className="admin-sidebar__user">
          <span className="admin-sidebar__initials" aria-hidden="true">
            {user.initials}
          </span>
          <div>
            <p>{user.name}</p>
            <span>Quản trị viên</span>
          </div>
        </div>
      )}
    </aside>
  );
}
