import { Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

/**
 * Plot editing already lives in the existing 2D map management screen.
 * Reuse that screen instead of maintaining the previous duplicated mock page.
 */
export default function LotManagementPage() {
  return <Navigate to={ROUTES.ADMIN_MAP} replace />;
}
