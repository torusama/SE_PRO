// src/components/layout/admin/AdminHeader.tsx
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { Bell } from 'lucide-react'

export default function AdminHeader() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function handleLogout() {
    logout()
    navigate(ROUTES.LOGIN)
  }

  return (
    <header
      style={{
        height: 52,
        background: '#ffffff',
        borderBottom: '1px solid #e5e2da'
      }}
      className="flex items-center justify-between px-7"
    >
      {/* Left */}
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#1a1a1a'
          }}
        >
          Dashboard
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#888'
          }}
        >
          Tổng quan hệ thống
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">

        <button
          style={{
            width: 34,
            height: 34,
            border: '1px solid #e5e2da',
            borderRadius: 8,
            background: '#fff'
          }}
          className="flex items-center justify-center hover:bg-[#E7F5F3]"
        >
          <Bell size={16} color="#555" />
        </button>

        {user && (
          <span
            style={{
              color: '#333',
              fontSize: 13
            }}
          >
            {user.name}
          </span>
        )}

        <button
          onClick={handleLogout}
          style={{
            background: '#008573',
            color: '#fff',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 12
          }}
        >
          Đăng xuất
        </button>

      </div>

    </header>
  ) 
}
