// src/components/auth/RequireAdmin.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'

/**
 * Chặn truy cập vào toàn bộ khu vực /admin nếu:
 *  - Chưa đăng nhập -> đẩy về trang login
 *  - Đã đăng nhập nhưng không phải admin -> đẩy về trang chủ khách hàng
 */
export default function RequireAdmin() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const location = useLocation()

  if (!token) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (role !== 'admin') {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <Outlet />
}
