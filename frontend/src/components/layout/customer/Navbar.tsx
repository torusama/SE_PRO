import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/authStore";
import BrandWordmark from "@/components/layout/shared/BrandWordmark";
import PrimaryNavigation from "@/components/layout/shared/PrimaryNavigation";
import AccountActions from "@/components/layout/shared/AccountActions";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="site-nav">
      <BrandWordmark />

      <PrimaryNavigation className="site-nav__primary" />

      {user ? (
        <AccountActions variant="dark" className="site-nav__account" />
      ) : (
        <button
          type="button"
          className="site-nav-cta"
          onClick={() => navigate(ROUTES.LOGIN)}
        >
          Đăng nhập
        </button>
      )}
    </header>
  );
}
