import { Outlet } from "react-router-dom";
import AdminHeader from "./AdminHeader";
import Sidebar from "./Sidebar";
import "@/styles/admin-theme.css";
import "@/styles/admin-page-unification.css";

export default function AdminLayout() {
  return (
    <div className="admin-theme admin-shell">
      <AdminHeader />
      <div className="admin-shell__lower">
        <Sidebar />
        <main className="admin-workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
