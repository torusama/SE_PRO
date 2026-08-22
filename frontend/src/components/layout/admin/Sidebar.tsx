import { NavLink } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { useAdminSidebarAlerts } from "../../../hooks/useAdminSidebarAlerts";

type MenuItem = {
  label: string;
  to: string;
  badge?: number;
  /** Key into useAdminSidebarAlerts() for a live "cần xử lý ngay" count. */
  alertKey?: "notify" | "requests" | "appointments" | "deceased";
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
      { label: "Thông báo", to: ROUTES.ADMIN_NOTIFY, alertKey: "notify" },
    ],
  },
  {
    // Thứ tự phản ánh đúng quy trình xử lý mua bán đất:
    // Xử lý yêu cầu -> Chuyển nhượng -> Hẹn lịch -> Duyệt hợp đồng -> Bàn giao (Bản đồ 2D).
    section: "Quản lý mua bán đất",
    items: [
      {
        label: "Xử lý yêu cầu",
        to: ROUTES.ADMIN_REQUESTS,
        alertKey: "requests",
      },
      { label: "Chuyển nhượng", to: ROUTES.ADMIN_TRANSFER },
      {
        label: "Phê duyệt lịch hẹn",
        to: ROUTES.ADMIN_APPOINTMENTS,
        alertKey: "appointments",
      },
      { label: "Hợp đồng & Sở hữu", to: ROUTES.ADMIN_CONTRACTS },
      { label: "Bản đồ 2D", to: ROUTES.ADMIN_MAP },
    ],
  },
  {
    section: "Quản lý dịch vụ",
    items: [
      { label: "Quản lý dịch vụ", to: ROUTES.ADMIN_SERVICES },
      { label: "Nhắc lịch ngày giỗ", to: ROUTES.ADMIN_REMINDERS },
      {
        label: "Hồ sơ người đã khuất",
        to: ROUTES.ADMIN_DECEASED,
        alertKey: "deceased",
      },
    ],
  },
  {
    section: "AI Agent",
    items: [{ label: "Quản trị AI Agent", to: ROUTES.ADMIN_AI_AGENT }],
  },
];

export default function Sidebar() {
  const alerts = useAdminSidebarAlerts();

  return (
    <aside className="admin-sidebar">
      <nav className="admin-sidebar__nav" aria-label="Điều hướng quản trị">
        {MENU.map((group) => (
          <section className="admin-nav-group" key={group.section}>
            <p className="admin-nav-group__label">{group.section}</p>
            <div className="admin-nav-group__items">
              {group.items.map((item) => {
                const liveCount = item.alertKey
                  ? alerts[item.alertKey]
                  : undefined;
                const badgeCount = liveCount ?? item.badge ?? 0;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === ROUTES.ADMIN_DASHBOARD}
                    className={({ isActive }) =>
                      `admin-nav-link${isActive ? " is-active" : ""}`
                    }
                  >
                    <span>{item.label}</span>
                    {badgeCount > 0 ? (
                      <span
                        className={`admin-nav-link__badge${
                          item.alertKey ? " admin-nav-link__badge--urgent" : ""
                        }`}
                        aria-label={`${badgeCount} cần xử lý`}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
