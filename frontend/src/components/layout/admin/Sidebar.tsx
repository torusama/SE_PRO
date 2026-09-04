import { NavLink } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  FileCheck2,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  Map,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { ROUTES } from "../../../constants/routes";
import { useAdminSidebarAlerts } from "../../../hooks/useAdminSidebarAlerts";

type MenuItem = {
  label: string;
  to: string;
  badge?: number;
  icon: typeof LayoutDashboard;
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
      { label: "Tổng quan", to: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard },
      { label: "Lịch sử hoạt động", to: ROUTES.ADMIN_ACTIVITY, icon: History },
      {
        label: "Thông báo",
        to: ROUTES.ADMIN_NOTIFY,
        alertKey: "notify",
        icon: Bell,
      },
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
        icon: FileCheck2,
      },
      { label: "Chuyển nhượng", to: ROUTES.ADMIN_TRANSFER, icon: GitBranch },
      {
        label: "Phê duyệt lịch hẹn",
        to: ROUTES.ADMIN_APPOINTMENTS,
        alertKey: "appointments",
        icon: CalendarDays,
      },
      {
        label: "Hợp đồng & Sở hữu",
        to: ROUTES.ADMIN_CONTRACTS,
        icon: ShieldCheck,
      },
      { label: "Bản đồ 2D", to: ROUTES.ADMIN_MAP, icon: Map },
    ],
  },
  {
    section: "Quản lý dịch vụ",
    items: [
      { label: "Quản lý dịch vụ", to: ROUTES.ADMIN_SERVICES, icon: FileText },
      {
        label: "Hồ sơ người đã khuất",
        to: ROUTES.ADMIN_DECEASED,
        alertKey: "deceased",
        icon: UsersRound,
      },
    ],
  },
  {
    section: "AI Agent",
    items: [
      {
        label: "Quản trị trợ lý AI",
        to: ROUTES.ADMIN_AI_AGENT,
        icon: Sparkles,
      },
    ],
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
                    <span className="admin-nav-link__main">
                      <span className="admin-nav-link__icon" aria-hidden="true">
                        <item.icon size={17} strokeWidth={1.8} />
                      </span>
                      <span className="admin-nav-link__title">
                        {item.label}
                      </span>
                    </span>
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
