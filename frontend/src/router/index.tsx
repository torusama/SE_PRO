// src/router/index.tsx
import { useLayoutEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLocation,
} from "react-router-dom";
import { ROUTES } from "@/constants/routes";

import CustomerLayout from "@/components/layout/customer/CustomerLayout";
import AdminLayout from "@/components/layout/admin/AdminLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import RequireCompleteProfile from "@/components/auth/RequireCompleteProfile";
import AuthUserSync from "@/components/auth/AuthUserSync";
import RealtimeConnection from "@/components/realtime/RealtimeConnection";

// Customer pages
import HomePage from "@/pages/customer/home/HomePage";
import MapPage from "@/pages/customer/map/MapPage";
import Map3DPage from "@/pages/customer/map/Map3DPage";
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
import DeceasedFamilyPage from "@/pages/shared/deceased-family/DeceasedFamilyPage";

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
import DeceasedProfilesAdminPage from "@/pages/admin/deceased-profiles/DeceasedProfilesAdminPage";

// Auth
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

// FIX: trước đây không có cơ chế nào đưa trang về đầu khi đổi route. Khi
// người dùng đang cuộn xuống giữa/cuối trang (ví dụ trang chủ) rồi bấm vào
// một liên kết (Xem dịch vụ, Đặt lịch hẹn, Nhắc lịch ngày giỗ,...), trình
// duyệt vẫn giữ nguyên vị trí cuộn (scrollY) cũ trong khi nội dung trang mới
// đã được vẽ ra, khiến người dùng thấy trang mới hiện ra ở giữa/cuối trước
// rồi mới "nhảy" lên đầu.
//
// RootLayout là route cha bọc TOÀN BỘ router (kể cả các trang auth, trang
// chủ, customer, admin) và dùng useLayoutEffect — hàm này chạy ĐỒNG BỘ ngay
// sau khi DOM được cập nhật nhưng TRƯỚC KHI trình duyệt vẽ khung hình lên
// màn hình. Nhờ vậy việc cuộn về đầu trang xảy ra trước khi người dùng kịp
// nhìn thấy bất kỳ khung hình nào ở vị trí cuộn cũ — trang mới hiện ra thẳng
// ở đầu ngay từ đầu, không còn hiện tượng "đang ở dưới rồi tự nhảy lên".
function RootLayout() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // === Auth (không có layout) ===
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.REGISTER, element: <RegisterPage /> },
      { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
      { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },

      // === Trang chủ — KHÔNG bọc CustomerLayout vì HomePage đã tự có nav + footer riêng ===
      { path: ROUTES.HOME, element: <HomePage /> },

      // === Bản đồ 3D — KHÔNG bọc CustomerLayout (không Navbar/Footer) vì
      // đây là trang xem toàn màn hình, có nút quay lại riêng. Vẫn yêu cầu
      // đăng nhập + hồ sơ đầy đủ giống trang "Bản đồ" 2D. ===
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireCompleteProfile />,
            children: [{ path: ROUTES.MAP_3D, element: <Map3DPage /> }],
          },
        ],
      },

      // === Customer routes (dùng layout chung: Navbar + Footer) ===
      {
        element: <CustomerLayout />,
        children: [
          // --- Cần đăng nhập (FR-01: chặn người chưa đăng nhập) ---
          {
            element: <RequireAuth />,
            children: [
              { path: ROUTES.PROFILE, element: <ProfilePage /> },
              { path: ROUTES.DECEASED_FAMILY, element: <DeceasedFamilyPage /> },

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
                  { path: ROUTES.TRANSFER, element: <LotDetailPage /> },
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
              {
                path: "ho-so-nguoi-da-khuat",
                element: <DeceasedProfilesAdminPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <>
      <RealtimeConnection />
      <AuthUserSync />
      <RouterProvider router={router} />
    </>
  );
}
