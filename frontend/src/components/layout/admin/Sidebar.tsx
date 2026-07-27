import { NavLink, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'

type MenuItem = {
  label: string
  to: string
  badge?: number
}

type MenuGroup = {
  section: string
  items: MenuItem[]
}

const MENU: MenuGroup[] = [
  { section: 'Tổng quan', items: [
    { label: 'Dashboard',         to: ROUTES.ADMIN_DASHBOARD },
    { label: 'Hoạt động gần đây', to: ROUTES.ADMIN_ACTIVITY },
  ]},
  { section: 'Lô đất', items: [
    { label: 'Bản đồ 2D',    to: ROUTES.ADMIN_MAP },
    { label: 'Quản lý lô đất', to: ROUTES.ADMIN_LOTS },
    { label: 'Xử lý yêu cầu', to: ROUTES.ADMIN_REQUESTS },
  ]},
  { section: 'Giao dịch', items: [
    { label: 'Hợp đồng & Sở hữu', to: ROUTES.ADMIN_CONTRACTS },
    { label: 'Quản lý dịch vụ',   to: ROUTES.ADMIN_SERVICES },
    { label: 'Thông báo',         to: ROUTES.ADMIN_NOTIFY },
    { label: 'Chuyển nhượng',     to: ROUTES.ADMIN_TRANSFER },
    { label: 'Phê duyệt lịch hẹn', to: ROUTES.ADMIN_APPOINTMENTS },
    { label: 'Nhắc lịch ngày giỗ', to: ROUTES.ADMIN_REMINDERS },
  ]},
]

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside style={{ width: 220, background: '#ffffff', borderRight: '1px solid #e5e2da' }}
      className="flex flex-col py-4 flex-shrink-0">

      {/* Logo */}
      <div className="px-5 pb-4 mb-5"
          style={{
            borderBottom: "1px solid #e5e2da"
          }}>
        <div
          onClick={() => navigate(ROUTES.HOME)}
          style={{ color: '#008573', fontWeight: 600, fontSize: 18, fontFamily: 'var(--font-display)', cursor: 'pointer' }}
          className="font-bold text-base"
        >
          Vĩnh Phúc Viên
        </div>
        <div style={{ fontSize:11, color: '#999' }} className="text-[10px] tracking-wider">CEMETERY MANAGEMENT</div>
        <span style={{ marginTop: 8, display: 'inline-block', background: '#008573', color: '#fff', padding :'3px 10px', borderRadius: 4, fontSize: 9 }}
          className="text-[9px] font-bold px-2 py-0.5 rounded mt-1 inline-block">
          ADMIN PORTAL
        </span>
      </div>

      {/* Menu sections */}
      <nav className="flex-1 overflow-y-auto">
        {MENU.map((group, index) => (
          <div key={group.section} className="mb-4">
            <div style={{ color: '#888', fontWeight: 600, letterSpacing: '0.12em' }} className="pl-3 pr-5 text-[10px] uppercase tracking-widest mb-1">
              {group.section}
            </div>
            {group.items.map(item => (
              <NavLink  key={item.to} to={item.to} className={({ isActive }) =>`sidebar-item ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px',
                  borderRadius: 8,
                  margin: '2px 10px',
                  transition: 'all .2s',
                  background: isActive ? '#008573' : 'transparent',
                  color: isActive ? '#ffffff': '#4a4a4a',
                  fontSize: 13,
                  textDecoration: 'none'  
                })}
                onMouseEnter={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.background = '#E7F5F3';
                      e.currentTarget.style.color = '#008573';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#4a4a4a';
                    }
                  }}>
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 10, }}
                    className="text-[10px] px-1.5 py-0.5 font-bold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
            {index < MENU.length - 1 && (
              <div
                style={{height: 1, background: '#e5e2da', margin: '10px 12px' }}
              />
            )}
          </div>
        ))}
      </nav>

      {/* User bottom */}
      <div style={{ borderTop: '1px solid var(--color-border)' }} className="p-4 flex items-center gap-3">
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent-teal)', color: '#0A1628' }}
          className="flex items-center justify-center font-bold text-xs flex-shrink-0">
          VA
        </div>
        <div>
          <div style={{ color: '#1a1a1a' }} className="text-xs font-medium">Võ Tấn An</div>
          <div style={{ color: '#888', fontWeight: 600 }} className="text-[10px]">Site Manager</div>
        </div>
      </div>
    </aside>
  )
}
