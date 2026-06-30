// src/components/layout/admin/AdminHeader.tsx
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'

export default function AdminHeader() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    navigate(ROUTES.LOGIN)
  }

  return (
    <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800 text-white">
      <h1 className="text-lg font-semibold">
        Admin Dashboard
      </h1>

      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-slate-300">
            {user.name}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 transition"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  )
}
