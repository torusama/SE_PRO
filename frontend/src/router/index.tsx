// src/router/index.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

import CustomerLayout from "@/components/layout/customer/CustomerLayout";
import AdminLayout from "@/components/layout/admin/AdminLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import RequireCompleteProfile from "@/components/auth/RequireCompleteProfile";
import AuthUserSync from "@/components/auth/AuthUserSync";

// Customer pages
import HomePage from "@/pages/customer/home/HomePage";
import MapPage from "@/pages/customer/map/MapPage";
import LotDetailPage from "@/pages/customer/lot-detail/LotDetailPage";
import BookingPage from "@/pages/customer/booking/BookingPage";
import PaymentPage from "@/pages/customer/payment/PaymentPage";
import ProfilePage from "@/pages/customer/profile/ProfilePage";
import ServicePage from "@/pages/customer/service/ServicePage";
import MyLotsPage from "@/pages/customer/my-lots/MyLotsPage";
import NotificationPage from "@/pages/customer/notification/NotificationPage";
import RemindersPage from "@/pages/customer/reminder/RemindersPage";
import AvailabilityPage from "@/pages/customer/availability/AvailabilityPage";
import AppointmentsPage from "@/pages/customer/appointments/AppointmentsPage";
import AgentPage from "@/pages/customer/ai-agent/AgentPage";

// Admin pages
import DashboardPage from "@/pages/admin/dashboard/DashboardPage";
import LotManagementPage from "@/pages/admin/lot-management/LotManagementPage";
import RequestsPage from "@/pages/admin/requests/RequestsPage";
import ActivityPage from "@/pages/admin/activity/ActivityPage";
import MapManagementPage from "@/pages/admin/map-management/MapManagementPage";
import ContractsPage from "@/pages/admin/contracts/ContractsPage";
import ServiceManagementPage from "@/pages/admin/service-management/ServiceManagementPage";
import NotificationManagementPage from "@/pages/admin/notification-management/NotificationManagementPage";
import TransferPage from "@/pages/admin/transfer/TransferPage";
import AppointmentManagementPage from "@/pages/admin/appointment-management/AppointmentManagementPage";
import ReminderManagementPage from "@/pages/admin/reminder-management/ReminderManagementPage";
import AgentAdminPage from "@/pages/admin/ai-agent/AgentAdminPage";

// Auth
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";

const router = createBrowserRouter([
  // === Auth (không có layout) ===
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  { path: ROUTES.REGISTER, element: <RegisterPage /> },
  { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },

  // === Trang chủ — KHÔNG bọc CustomerLayout vì HomePage đã tự có nav + footer riêng ===
  { path: ROUTES.HOME, element: <HomePage /> },

  // === Customer routes (dùng layout chung: Navbar + Footer) ===
  {
    element: <CustomerLayout />,
    children: [
      // --- Cần đăng nhập (FR-01: chặn người chưa đăng nhập) ---
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.PROFILE, element: <ProfilePage /> },

          {
            element: <RequireCompleteProfile />,
            children: [
              { path: ROUTES.MAP, element: <MapPage /> },
              { path: ROUTES.LOT_DETAIL, element: <LotDetailPage /> },
              { path: ROUTES.SERVICES, element: <ServicePage /> },
              { path: ROUTES.AVAILABILITY, element: <AvailabilityPage /> },
              { path: ROUTES.APPOINTMENTS, element: <AppointmentsPage /> },
              { path: ROUTES.REMINDERS, element: <RemindersPage /> },
              { path: ROUTES.BOOKING, element: <BookingPage /> },
              { path: ROUTES.PAYMENT, element: <PaymentPage /> },
              { path: ROUTES.MY_LOTS, element: <MyLotsPage /> },
              { path: ROUTES.NOTIFICATION, element: <NotificationPage /> },
              { path: ROUTES.AI_AGENT, element: <AgentPage /> },
            ],
          },
        ],
      },
    ],
  },

  // === Admin routes (chỉ role = admin, FR-01: chặn người không có quyền) ===
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "lo-dat", element: <LotManagementPage /> },
          { path: "yeu-cau", element: <RequestsPage /> },
          { path: "hoat-dong", element: <ActivityPage /> },
          { path: "ban-do", element: <MapManagementPage /> },
          { path: "hop-dong", element: <ContractsPage /> },
          { path: "dich-vu", element: <ServiceManagementPage /> },
          { path: "thong-bao", element: <NotificationManagementPage /> },
          { path: "chuyen-nhuong", element: <TransferPage /> },
          { path: "lich-hen", element: <AppointmentManagementPage /> },
          { path: "nhac-lich", element: <ReminderManagementPage /> },
          { path: "ai-agent", element: <AgentAdminPage /> },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <>
      <AuthUserSync />
      <RouterProvider router={router} />
    </>
  );
}
