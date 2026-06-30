import { NavLink } from 'react-router-dom'
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
    { label: 'Hoạt động gần đây', to: '/admin/hoat-dong' },
  ]},
  { section: 'Lô đất', items: [
    { label: 'Bản đồ 2D',    to: ROUTES.ADMIN_MAP },
    { label: 'Quản lý lô đất', to: ROUTES.ADMIN_LOTS, badge: 5 },
    { label: 'Xử lý yêu cầu', to: ROUTES.ADMIN_REQUESTS, badge: 7 },
  ]},
  { section: 'Nghiệp vụ', items: [
    { label: 'Hợp đồng & Sở hữu', to: ROUTES.ADMIN_CONTRACTS },
    { label: 'Quản lý dịch vụ',   to: ROUTES.ADMIN_SERVICES, badge: 4 },
    { label: 'Thông báo',         to: ROUTES.ADMIN_NOTIFY },
    { label: 'Chuyển nhượng',     to: ROUTES.ADMIN_TRANSFER },
  ]},
]

export default function Sidebar() {
  return (
    <aside style={{ width: 180, background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}
      className="flex flex-col py-4 flex-shrink-0">

      {/* Logo */}
      <div className="px-4 mb-6">
        <div style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-display)' }} className="font-bold text-base">
          Vĩnh Phúc Viên
        </div>
        <div style={{ color: 'var(--color-text-muted)' }} className="text-[10px] tracking-wider">永 福 苑</div>
        <span style={{ background: 'var(--color-accent-teal)', color: '#0A1628' }}
          className="text-[9px] font-bold px-2 py-0.5 rounded mt-1 inline-block">
          Admin Portal
        </span>
      </div>

      {/* Menu sections */}
      <nav className="flex-1 overflow-y-auto">
        {MENU.map(group => (
          <div key={group.section} className="mb-4">
            <div style={{ color: 'var(--color-text-muted)' }} className="px-4 text-[10px] uppercase tracking-widest mb-1">
              {group.section}
            </div>
            {group.items.map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px',
                  background: isActive ? 'rgba(0,200,160,0.12)' : 'transparent',
                  color: isActive ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                  fontSize: 13,
                  borderLeft: isActive ? '2px solid var(--color-accent-teal)' : '2px solid transparent',
                })}>
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: 10 }}
                    className="text-[10px] px-1.5 py-0.5 font-bold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
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
          <div style={{ color: 'var(--color-text-primary)' }} className="text-xs font-medium">Võ Tấn An</div>
          <div style={{ color: 'var(--color-text-muted)' }} className="text-[10px]">Project Manager</div>
        </div>
      </div>
    </aside>
  )
}