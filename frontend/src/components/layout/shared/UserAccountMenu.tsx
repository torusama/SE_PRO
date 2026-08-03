import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AccountMenu, { type AccountMenuItem } from "./AccountMenu";

type UserAccountMenuProps = {
  variant?: "dark" | "light";
  className?: string;
};

export default function UserAccountMenu({
  variant = "dark",
  className,
}: UserAccountMenuProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const items: AccountMenuItem[] = [
    { label: "Hồ sơ cá nhân", onSelect: () => navigate(ROUTES.PROFILE) },
    { label: "Lô của tôi", onSelect: () => navigate(ROUTES.MY_LOTS) },
    {
      label: "Lịch hẹn tư vấn",
      onSelect: () => navigate(ROUTES.APPOINTMENTS),
    },
  ];

  items.push({
    label: "Đăng xuất",
    tone: "danger",
    onSelect: () => {
      api.post("/auth/logout").catch(() => {});
      logout();
      navigate(ROUTES.LOGIN);
    },
  });

  return (
    <AccountMenu
      name={user.name}
      items={items}
      variant={variant}
      className={className}
    />
  );
}
