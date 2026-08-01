import { useAuthStore } from "@/store/authStore";
import NotificationMenu from "./NotificationMenu";
import UserAccountMenu from "./UserAccountMenu";
import "./account-actions.css";

type AccountActionsProps = {
  variant?: "dark" | "light";
  className?: string;
};

export default function AccountActions({
  variant = "dark",
  className = "",
}: AccountActionsProps) {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  return (
    <div className={`account-actions${className ? ` ${className}` : ""}`}>
      <NotificationMenu variant={variant} />
      <UserAccountMenu variant={variant} />
    </div>
  );
}
