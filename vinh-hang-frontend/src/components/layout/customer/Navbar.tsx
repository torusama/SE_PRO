// src/components/layout/customer/Navbar.tsx
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { useAuthStore } from '@/store/authStore'

const NAV_LINKS = [
  { label: 'Bản đồ',     to: ROUTES.MAP },
  { label: 'Lô của tôi', to: ROUTES.MY_LOTS },
  { label: 'Dịch vụ',   to: ROUTES.SERVICES },
  { label: 'Thông báo', to: ROUTES.NOTIFICATION },
]

export default function Navbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate(ROUTES.LOGIN)
  }

  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)' }}
      className="sticky top-0 z-50 px-8 py-4 flex items-center justify-between">

      {/* Logo */}
      <Link to={ROUTES.HOME} className="flex flex-col leading-none">
        <span style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-display)' }} className="font-bold text-lg">
          Vĩnh Hằng
        </span>
        <span style={{ color: 'var(--color-accent-teal)' }} className="text-[10px] tracking-widest uppercase">
          Cemetery Management
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex gap-8">
        {NAV_LINKS.map(link => (
          <NavLink key={link.to} to={link.to}
            style={({ isActive }) => ({
              color: isActive ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
            })}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      {user ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent-teal)', color: '#0A1628', border: 'none', cursor: 'pointer' }}
            className="flex items-center justify-center font-bold text-sm"
          >
            {user.initials}
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '44px',
                background: '#0F1F38',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                minWidth: '180px',
                overflow: 'hidden',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                {user.name}
              </div>
              <Link
                to={ROUTES.PROFILE}
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '10px 14px', fontSize: '13px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
              >
                Hồ sơ của tôi
              </Link>
              <button
                onClick={handleLogout}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '13px', color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => navigate(ROUTES.LOGIN)}
          style={{ background: 'var(--color-accent-teal)', color: '#0A1628', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Đăng nhập
        </button>
      )}
    </header>
  )
}
