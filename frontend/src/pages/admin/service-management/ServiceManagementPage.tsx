// src/pages/admin/service-management/ServiceManagementPage.tsx
import { useMemo, useState } from 'react'

type ServiceCategory = 'Lau dọn' | 'Trồng hoa' | 'Cúng giỗ' | 'Chụp ảnh'
type ServiceStatus = 'awaiting' | 'inProgress' | 'done'

interface ServiceOrder {
  id: string
  category: ServiceCategory
  icon: string
  customer: string
  lot: string
  date: string
  staff: string
  status: ServiceStatus
}

const STATUS_META: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  awaiting:   { label: 'Chờ xác nhận', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  inProgress: { label: 'Đang thực hiện', color: '#4A9EFF', bg: 'rgba(74,158,255,0.14)' },
  done:       { label: 'Hoàn thành', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
}

const INITIAL_ORDERS: ServiceOrder[] = [
  { id: 'DV-2025-0156', category: 'Lau dọn', icon: '🧹', customer: 'Lê Thị Hương', lot: 'B-05', date: '02/07/2025', staff: '—', status: 'awaiting' },
  { id: 'DV-2025-0155', category: 'Trồng hoa', icon: '🌸', customer: 'Nguyễn Bích Chi', lot: 'A-31', date: '30/06/2025', staff: 'Minh Tuấn', status: 'inProgress' },
  { id: 'DV-2025-0154', category: 'Chụp ảnh', icon: '📸', customer: 'Võ Thanh Hải', lot: 'B-22', date: '29/06/2025', staff: 'Huy Phát', status: 'inProgress' },
  { id: 'DV-2025-0150', category: 'Cúng giỗ', icon: '🕯️', customer: 'Phạm Văn Tuấn', lot: 'C-18', date: '28/06/2025', staff: '—', status: 'awaiting' },
  { id: 'DV-2025-0148', category: 'Lau dọn', icon: '🧹', customer: 'Trần Văn Long', lot: 'D-07', date: '25/06/2025', staff: 'Minh Tuấn', status: 'done' },
  { id: 'DV-2025-0143', category: 'Trồng hoa', icon: '🌸', customer: 'Nguyễn Văn Thành', lot: 'A-12', date: '22/06/2025', staff: 'Huy Phát', status: 'done' },
]

const CATEGORIES: (ServiceCategory | 'Tất cả')[] = ['Tất cả', 'Lau dọn', 'Trồng hoa', 'Cúng giỗ', 'Chụp ảnh']
const STAFF_POOL = ['Minh Tuấn', 'Huy Phát', 'Lan Anh', 'Thu Trang']

const panelStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 12,
}

export default function ServiceManagementPage() {
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tất cả')

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (category === 'Tất cả' || o.category === category) &&
          (!search.trim() ||
            o.id.toLowerCase().includes(search.trim().toLowerCase()) ||
            o.customer.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [orders, search, category],
  )

  const totalThisMonth = orders.length + 32
  const awaiting = orders.filter((o) => o.status === 'awaiting').length
  const inProgress = orders.filter((o) => o.status === 'inProgress').length
  const done = orders.filter((o) => o.status === 'done').length

  function acceptOrder(id: string) {
    const nextStaff = STAFF_POOL[Math.floor(Math.random() * STAFF_POOL.length)]
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: 'inProgress', staff: nextStaff } : o)))
    // TODO: gọi api.patch(`/admin/services/${id}/accept`, { staff: nextStaff })
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Quản lý dịch vụ</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            FR-11 · Xử lý đơn dịch vụ &amp; lịch thực hiện
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: 'rgba(245,166,35,0.16)', color: '#F5A623', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
            {awaiting} chờ xác nhận
          </span>
          <button style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
            + Thêm dịch vụ
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={{ ...panelStyle, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20 }}>🛠️</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{totalThisMonth}</div><div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Tổng đơn tháng này</div></div>
        </div>
        <div style={{ ...panelStyle, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20 }}>⏳</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: '#F5A623' }}>{awaiting}</div><div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Chờ xác nhận</div></div>
        </div>
        <div style={{ ...panelStyle, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20 }}>🔧</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: '#4A9EFF' }}>{inProgress}</div><div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Đang thực hiện</div></div>
        </div>
        <div style={{ ...panelStyle, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: '#00C8A0' }}>{done}</div><div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Hoàn thành</div></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Tìm đơn dịch vụ..." style={{ ...inputStyle, minWidth: 220 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                border: '1px solid var(--color-border)',
                background: category === c ? 'rgba(0,200,160,0.14)' : 'transparent',
                color: category === c ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                fontWeight: category === c ? 600 : 400,
                borderRadius: 7,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Mã đơn', 'Dịch vụ', 'Khách hàng', 'Lô đất', 'Ngày thực hiện', 'Nhân viên', 'Trạng thái', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Không có đơn dịch vụ nào khớp bộ lọc.</td></tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-accent-teal)', fontWeight: 600 }}>{o.id}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>{o.icon} {o.category}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{o.customer}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{o.lot}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{o.date}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{o.staff}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: STATUS_META[o.status].bg, color: STATUS_META[o.status].color, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                      {STATUS_META[o.status].label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {o.status === 'awaiting' ? (
                      <button
                        onClick={() => acceptOrder(o.id)}
                        style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                        Nhận đơn
                      </button>
                    ) : (
                      <button style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                        Chi tiết
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
