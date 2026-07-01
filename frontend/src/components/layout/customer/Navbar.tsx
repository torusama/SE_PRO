// src/components/layout/customer/Navbar.tsx
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { useAuthStore } from '@/store/authStore'

const NAV_LINKS = [
  { label: 'Bản đồ',     to: ROUTES.MAP },
  { label: 'Lô của tôi', to: ROUTES.MY_LOTS },
  { label: 'Dịch vụ',   to: ROUTES.SERVICES },
  { label: 'Nhắc nhở', to: ROUTES.NOTIFICATION },
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
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          padding: '20px 48px',
          borderBottom: '0.5px solid rgba(0,229,196,0.12)',
          background: 'rgba(4,6,14,0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
      {/* Logo */}
      <Link to={ROUTES.HOME} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ color: 'var(--gold)', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 18, letterSpacing: '0.03em' }}>
          Vĩnh Hằng
        </span>
        <span style={{ color: 'var(--teal-glow)',fontFamily: "'Be VietNam Pro',sans-serif", fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
          CEMETERY MANAGEMENT 
        </span>
      </Link>

      {/* Nav links — sát nhau, luôn nằm giữa vì logo & user-area chiếm 2 bên bằng flex */}
      <nav
        style={{
        display:'flex',
        gap:32,
        marginLeft: '80px',
        flex: 1,
        justifySelf:'center',
        alignItems: 'center'
        }}
      >
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              color: isActive ? 'var(--teal-glow)' : 'var(--text-muted)',
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: '13px',
              fontWeight: 400,
              letterSpacing: '0.05em',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            })}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--teal-glow)';
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      {user ? (
        <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0, zIndex: 10000 }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer',padding: 0, color: 'var(--teal-glow)', fontSize: 13, fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            <span style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--color-border-focus)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#00e5c4', background: 'rgba(0,200,160,0.06)', flexShrink:0, }}>
              {user.initials}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '32px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: '#7a9a90',
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </span>
            </div>
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 44,
                background: '#0F1F38',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                minWidth: 180,
                overflow: 'hidden',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                {user.name}
              </div>
              <Link
                  to={ROUTES.HOME}
                  style={{
                      textDecoration:'none',
                      display:'flex',
                      flexDirection:'column',
                      justifySelf:'start'
                  }}
              >
                Hồ sơ của tôi
              </Link>
              <button
                onClick={handleLogout}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => navigate(ROUTES.LOGIN)}
          style={{ background: 'var(--color-accent-teal)', color: '#0A1628', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Đăng nhập
        </button>
      )}
    </header>
  )
}