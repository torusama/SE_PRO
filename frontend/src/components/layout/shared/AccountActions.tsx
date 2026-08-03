import { useAuthStore } from "@/store/authStore";
import NotificationMenu from "./NotificationMenu";
import UserAccountMenu from "./UserAccountMenu";
import "./account-actions.css";

type AccountActionsProps = {
  variant?: "dark" | "light";
  className?: string;
  showNotification?: boolean;
};

export default function AccountActions({
  variant = "dark",
  className = "",
  showNotification = true,
}: AccountActionsProps) {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  if (!user) return null;

  const shouldShowNotification = showNotification && role !== "admin";

  return (
    <div className={`account-actions${className ? ` ${className}` : ""}`}>
      {shouldShowNotification && <NotificationMenu variant={variant} />}
      <UserAccountMenu variant={variant} />
    </div>
  );
}
