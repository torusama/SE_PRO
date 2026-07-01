// src/router/index.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

import CustomerLayout from '@/components/layout/customer/CustomerLayout'
import AdminLayout    from '@/components/layout/admin/AdminLayout'
import RequireAuth     from '@/components/auth/RequireAuth'
import RequireAdmin    from '@/components/auth/RequireAdmin'

// Customer pages
import HomePage         from '@/pages/customer/home/HomePage'
import MapPage          from '@/pages/customer/map/MapPage'
import LotDetailPage    from '@/pages/customer/lot-detail/LotDetailPage'
import BookingPage      from '@/pages/customer/booking/BookingPage'
import PaymentPage      from '@/pages/customer/payment/PaymentPage'
import ProfilePage      from '@/pages/customer/profile/ProfilePage'
import ServicePage      from '@/pages/customer/service/ServicePage'
import MyLotsPage       from '@/pages/customer/my-lots/MyLotsPage'
import NotificationPage from '@/pages/customer/notification/NotificationPage'

// Admin pages
import DashboardPage    from '@/pages/admin/dashboard/DashboardPage'
import LotManagementPage from '@/pages/admin/lot-management/LotManagementPage'
import RequestsPage     from '@/pages/admin/requests/RequestsPage'

// Auth
import LoginPage    from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'

const router = createBrowserRouter([
  // === Auth (không có layout) ===
  { path: ROUTES.LOGIN,    element: <LoginPage /> },
  { path: ROUTES.REGISTER, element: <RegisterPage /> },

  // === Trang chủ — KHÔNG bọc CustomerLayout vì HomePage đã tự có
  // nav + footer riêng (thiết kế landing page độc lập).
  // Bọc thêm CustomerLayout sẽ tạo ra 2 lớp nav/footer chồng lên nhau.
  { path: ROUTES.HOME, element: <HomePage /> },

  // === Customer routes (dùng layout chung: Navbar + Footer) ===
  {
    element: <CustomerLayout />,
    children: [
      // --- Công khai: ai cũng xem được, không cần đăng nhập ---
      { path: ROUTES.MAP,        element: <MapPage /> },
      { path: ROUTES.LOT_DETAIL, element: <LotDetailPage /> },
      { path: ROUTES.SERVICES,   element: <ServicePage /> },

      // --- Cần đăng nhập (FR-01: chặn người chưa đăng nhập) ---
      {
        element: <RequireAuth />,
        children: [
          { path: ROUTES.BOOKING,      element: <BookingPage /> },
          { path: ROUTES.PAYMENT,      element: <PaymentPage /> },
          { path: ROUTES.MY_LOTS,      element: <MyLotsPage /> },
          { path: ROUTES.PROFILE,      element: <ProfilePage /> },
          { path: ROUTES.NOTIFICATION, element: <NotificationPage /> },
        ],
      },
    ],
  },

  // === Admin routes (chỉ role = admin, FR-01: chặn người không có quyền) ===
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true,     element: <DashboardPage /> },
          { path: 'lo-dat',  element: <LotManagementPage /> },
          { path: 'yeu-cau', element: <RequestsPage /> },
          // ... thêm tiếp
        ],
      },
    ],
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
