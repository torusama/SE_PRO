// src/components/layout/customer/Navbar.tsx
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { useAuthStore } from '@/store/authStore'

const TXT = {
  brand: 'V\u0129nh Ph\u00fac Vi\u00ean',
  subtitle: 'Ngh\u0129a trang sinh th\u00e1i',
  map: 'B\u1ea3n \u0111\u1ed3',
  myLots: 'L\u00f4 c\u1ee7a t\u00f4i',
  services: 'D\u1ecbch v\u1ee5',
  reminders: 'Nh\u1eafc nh\u1edf',
  profile: 'H\u1ed3 s\u01a1 c\u1ee7a t\u00f4i',
  logout: '\u0110\u0103ng xu\u1ea5t',
  login: '\u0110\u0103ng nh\u1eadp',
}

const NAV_LINKS = [
  { label: TXT.map, to: ROUTES.MAP },
  { label: TXT.myLots, to: ROUTES.MY_LOTS },
  { label: TXT.services, to: ROUTES.SERVICES },
  { label: TXT.reminders, to: ROUTES.NOTIFICATION },
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
        display: 'grid',
        gridTemplateColumns: 'minmax(210px, 260px) minmax(360px, 1fr) minmax(140px, 220px)',
        alignItems: 'center',
        columnGap: 24,
        minHeight: 94,
        padding: '18px 48px',
        borderBottom: '0.5px solid rgba(0,229,196,0.12)',
        background: '#04060e',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }}
    >
      <Link to={ROUTES.HOME} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', lineHeight: 1.05, minWidth: 0 }}>
        <span style={{ color: '#f0c060', fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 700, fontSize: 22, letterSpacing: 0, whiteSpace: 'nowrap', opacity: 1, filter: 'none', textShadow: 'none', WebkitFontSmoothing: 'antialiased' }}>
          {TXT.brand}
        </span>
        <span style={{ color: '#00e5c4', fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 5, whiteSpace: 'nowrap', opacity: 1, filter: 'none', textShadow: 'none', WebkitFontSmoothing: 'antialiased' }}>
          {TXT.subtitle}
        </span>
      </Link>

      <nav
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'clamp(24px, 4vw, 76px)',
          minWidth: 0,
        }}
      >
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              color: isActive ? 'var(--teal-glow)' : 'var(--text-muted)',
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: 0,
              textDecoration: 'none',
              transition: 'color 0.2s ease',
              whiteSpace: 'nowrap',
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ justifySelf: 'end', minWidth: 0 }}>
        {user ? (
          <div style={{ position: 'relative', zIndex: 10000 }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--teal-glow)', fontSize: 13, fontFamily: "'Be Vietnam Pro', sans-serif" }}
            >
              <span style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--color-border-focus)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#00e5c4', background: 'rgba(0,200,160,0.06)', flexShrink: 0 }}>
                {user.initials}
              </span>
              <span style={{ fontSize: 14, color: '#7a9a90', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                {user.name}
              </span>
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 46,
                  background: '#0F1F38',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  minWidth: 190,
                  overflow: 'hidden',
                  zIndex: 60,
                }}
              >
                <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  {user.name}
                </div>
                <Link to={ROUTES.HOME} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 14px', fontSize: 13, color: 'var(--text-main)', textDecoration: 'none' }}>
                  {TXT.profile}
                </Link>
                <button type="button" onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {TXT.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => navigate(ROUTES.LOGIN)} style={{ background: 'var(--color-accent-teal)', color: '#0A1628', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {TXT.login}
          </button>
        )}
      </div>
    </header>
  )
}
