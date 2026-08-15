// src/components/layout/customer/CustomerLayout.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/authStore";
import Navbar from "./Navbar";

export default function CustomerLayout() {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (token && role === "admin") {
    return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />;
  }

  const isAgentPage = location.pathname === ROUTES.AI_AGENT;
  // Map page only locks to the viewport (no page-level scroll) on wider
  // screens where the 3-column layout applies; on narrower screens it keeps
  // the normal scrollable fallback (stacked panels + footer).
  const isMapPage = location.pathname === ROUTES.MAP;

  return (
    <div
      className={`flex flex-col ${
        isAgentPage
          ? "h-screen overflow-hidden"
          : isMapPage
            ? "min-h-screen min-[1181px]:h-screen min-[1181px]:overflow-hidden"
            : "min-h-screen"
      }`}
      style={{
        background: "var(--color-bg-primary)",
        ...(isAgentPage ? { height: "100dvh", minHeight: 0 } : {}),
      }}
    >
      <Navbar />
      <main
        className={`flex-1 ${
          isAgentPage
            ? "min-h-0 overflow-hidden"
            : isMapPage
              ? "min-[1181px]:min-h-0 min-[1181px]:overflow-hidden"
              : ""
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
