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

  const notificationAudience = role === "admin" ? "admin" : "customer";

  return (
    <div className={`account-actions${className ? ` ${className}` : ""}`}>
      {showNotification && (
        <NotificationMenu
          variant={variant}
          audience={notificationAudience}
        />
      )}
      <UserAccountMenu variant={variant} />
    </div>
  );
}
