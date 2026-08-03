import BrandWordmark from "@/components/layout/shared/BrandWordmark";
import PrimaryNavigation from "@/components/layout/shared/PrimaryNavigation";
import AccountActions from "@/components/layout/shared/AccountActions";

export default function AdminHeader() {
  return (
    <header className="admin-header">
      <BrandWordmark />

      <PrimaryNavigation
        className="admin-header__navigation"
        variant="light"
      />

      <AccountActions variant="light" className="admin-account" />
    </header>
  );
}
