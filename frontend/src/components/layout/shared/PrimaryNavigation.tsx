import { NavLink } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/authStore";
import "./shared-navigation.css";

type PrimaryNavigationProps = {
  className?: string;
  variant?: "dark" | "light";
};

const PUBLIC_ITEMS = [
  { label: "Trang chủ", to: ROUTES.HOME },
  { label: "Bản đồ", to: ROUTES.MAP },
  { label: "Dịch vụ", to: ROUTES.SERVICES },
  { label: "AI tư vấn", to: ROUTES.AI_AGENT },
] as const;

export default function PrimaryNavigation({
  className = "",
  variant = "dark",
}: PrimaryNavigationProps) {
  const role = useAuthStore((state) => state.role);
  const customerItems = role === "customer"
    ? [...PUBLIC_ITEMS, { label: "Gia đình tưởng niệm", to: ROUTES.DECEASED_FAMILY }]
    : PUBLIC_ITEMS;
  const items =
    role === "admin"
      ? [...customerItems, { label: "Admin", to: ROUTES.ADMIN_DASHBOARD }]
      : customerItems;

  return (
    <nav
      className={`primary-navigation primary-navigation--${variant}${
        className ? ` ${className}` : ""
      }`}
      aria-label="Điều hướng chức năng"
    >
      <ul className="primary-navigation__list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === ROUTES.HOME || item.to === ROUTES.AI_AGENT}
              className={({ isActive }) =>
                `primary-navigation__link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
