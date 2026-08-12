import BrandWordmark from "@/components/layout/shared/BrandWordmark";
import AccountActions from "@/components/layout/shared/AccountActions";

export default function AdminHeader() {
  return (
    <header className="admin-header">
      <BrandWordmark />

      <AccountActions variant="light" className="admin-account" showNotification={false} />
    </header>
  );
}
