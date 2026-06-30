// src/components/auth/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'

/**
 * Chặn truy cập vào các route con nếu chưa đăng nhập.
 * Dùng cho các trang khách hàng cần tài khoản: lô của tôi, đặt chỗ,
 * thanh toán, hồ sơ, thông báo...
 */
export default function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()

  if (!token) {
    // Lưu lại trang đang muốn vào, để sau khi đăng nhập có thể quay lại
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <Outlet />
}
