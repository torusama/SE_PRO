// src/components/auth/RequireCompleteProfile.tsx
// Chặn các trang chức năng chính nếu hồ sơ cá nhân CHƯA hoàn thiện (thiếu họ tên,
// SĐT, ngày sinh, giới tính hoặc địa chỉ ở bảng `users`). Trạng thái này luôn được
// đọc từ backend (đăng nhập/đăng ký trả về, hoặc GET /users/me nếu chưa biết) —
// không suy đoán/hard-code ở frontend.
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'

export default function RequireCompleteProfile() {
  const profileComplete = useAuthStore((s) => s.profileComplete)
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete)
  const location = useLocation()
  const [checking, setChecking] = useState(profileComplete === null)

  useEffect(() => {
    if (profileComplete !== null) return
    let cancelled = false
    api
      .get('/users/me')
      .then((res) => {
        if (!cancelled) setProfileComplete(Boolean(res.data?.data?.isProfileComplete))
      })
      .catch(() => {
        // Nếu không kiểm tra được (lỗi mạng...), không chặn người dùng —
        // để RequireAuth/401-interceptor xử lý các lỗi xác thực thật sự.
        if (!cancelled) setProfileComplete(true)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileComplete, setProfileComplete])

  if (checking) return null

  if (profileComplete === false) {
    return (
      <Navigate
        to={ROUTES.PROFILE}
        state={{ from: location, requireProfile: true }}
        replace
      />
    )
  }

  return <Outlet />
}
